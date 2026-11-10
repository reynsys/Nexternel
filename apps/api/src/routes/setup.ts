import { passwordChecks, passwordProblem } from "../auth/password-rules.js";
import { TERMS_VERSION } from "@nexternel/domain";
import { parseEmail } from "../auth/outside-lock.js";
import { parseThemePrefsInput } from "../auth/theme-prefs.js";
import { normalizeHomeName, recordTermsAccepted, setHome } from "../system/home.js";
import { placeSearchReply } from "./weather.js";
import type { FastifyPluginAsync } from "fastify";
import { getPool } from "../db.js";
import { hashPassword, signAccessToken, signRefreshToken } from "../auth/tokens.js";
import { clearAuthCookies, setAuthCookies } from "../auth/plugin.js";
import { config } from "../config.js";
import { APP_VERSION } from "../version.js";
import {
  bootstrapInstallationState,
  getUserCount,
  isSetupComplete,
  markSetupComplete,
} from "../installation-meta.js";
import { resolveRoleInfo } from "../auth/roles.js";
import { themePrefsFromDb } from "../auth/theme-prefs.js";
import { createJob, getJob, updateJob } from "../backup/jobs.js";
import { inspectBackupFile, mapBackupError, runRestoreBackupJob } from "../backup/restore-service.js";
import { readBackupUpload } from "../backup/upload.js";
import { ensureStarterDashboard } from "../dashboards/starter.js";
import { localHostName, refreshHostIp } from "../system/host-ip.js";

/** Restores started from the welcome screen — their progress stays readable once accounts exist. */
const welcomeRestoreJobs = new Set<string>();

function welcomeRestoreRunning(): boolean {
  for (const id of welcomeRestoreJobs) {
    const status = getJob(id)?.status;
    if (status && status !== "completed" && status !== "failed") return true;
  }
  return false;
}

/** The town chosen in setup for the first weather panel, or null (skipped, or not a real place). */
function setupPlace(raw: unknown): { name: string; latitude: number; longitude: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim().slice(0, 80) : "";
  const lat = Number(o.latitude);
  const lon = Number(o.longitude);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { name, latitude: lat, longitude: lon };
}

export const setupRoutes: FastifyPluginAsync = async (app) => {
  /*
   * Restore from the welcome screen: a new server takes over a home from its backup before any
   * account exists. Open only while setup is still needed — exactly like creating the first admin.
   * The backup's own accounts are restored, so the owner then signs in with their usual login.
   */
  app.post("/api/v1/setup/restore/inspect", async (request, reply) => {
    if (!(await bootstrapInstallationState()).needsSetup) {
      return reply.code(403).send({ error: { code: "already_setup", message: "Nexternel is already set up. Sign in to restore a backup." } });
    }
    try {
      const { fileBuffer, fields } = await readBackupUpload(request);
      if (!fileBuffer?.length) {
        return reply.code(400).send({ error: { code: "bad_request", message: "Choose a backup file." } });
      }
      if (!fields.password) {
        return reply.code(400).send({ error: { code: "bad_request", message: "Enter the backup password or key." } });
      }
      return await inspectBackupFile(fileBuffer, fields.password);
    } catch (err) {
      return reply.code(400).send({ error: mapBackupError(err) });
    }
  });

  app.post("/api/v1/setup/restore", async (request, reply) => {
    if (!(await bootstrapInstallationState()).needsSetup) {
      return reply.code(403).send({ error: { code: "already_setup", message: "Nexternel is already set up. Sign in to restore a backup." } });
    }
    if (welcomeRestoreRunning()) {
      return reply.code(409).send({ error: { code: "restore_running", message: "A restore is already running." } });
    }
    try {
      const { fileBuffer, fields } = await readBackupUpload(request);
      const password = fields.password ?? "";
      if (!fileBuffer?.length || !password) {
        return reply.code(400).send({ error: { code: "bad_request", message: "Choose a backup file and enter its password or key." } });
      }
      if (fields.termsVersion !== TERMS_VERSION) {
        return reply.code(400).send({
          error: { code: "terms_not_accepted", message: "Please read and agree to the terms of use first." },
        });
      }
      const inspect = await inspectBackupFile(fileBuffer, password);
      if (!inspect.valid || !inspect.compatible) {
        return reply.code(400).send({
          error: { code: "backup_invalid", message: inspect.blockingErrors.join(" ") || "This backup cannot be restored." },
        });
      }
      // Agreed on this machine now; the restore keeps this unless the backup holds a newer agreement.
      await recordTermsAccepted(TERMS_VERSION, "");
      const job = createJob("restore");
      welcomeRestoreJobs.add(job.id);
      updateJob(job.id, { status: "queued", message: "Starting restore" });
      void runRestoreBackupJob(job.id, fileBuffer, password, {});
      return { job };
    } catch (err) {
      return reply.code(400).send({ error: mapBackupError(err) });
    }
  });

  app.get<{ Params: { id: string } }>("/api/v1/setup/restore/jobs/:id", async (request, reply) => {
    const job = welcomeRestoreJobs.has(request.params.id) ? getJob(request.params.id) : null;
    if (!job) return reply.code(404).send({ error: { code: "not_found", message: "Restore not found." } });
    return { job };
  });

  app.get("/api/v1/setup/status", async () => {
    const state = await bootstrapInstallationState();
    if (state.needsSetup) await refreshHostIp();
    const lanIp = config.serverIp()?.trim() || null;
    return {
      needsSetup: state.needsSetup,
      version: APP_VERSION,
      serverIp: lanIp,
      /** The addresses to open Nexternel at home, the name first ("http://nexternel.local", then the IP). */
      localAddresses: [`http://${localHostName()}`, ...(lanIp ? [`http://${lanIp}`] : [])],
      /** The time zone this machine runs in (shown in setup; set at install time). */
      timeZone: process.env.TZ?.trim() || "",
      termsVersion: TERMS_VERSION,
      installationReady: !state.needsSetup,
    };
  });

  /** Live password ticks: open while setup is needed, and to anyone signed in. */
  app.post<{ Body: { password?: unknown; username?: unknown } }>("/api/v1/setup/password-check", async (request, reply) => {
    if (!request.user && !(await bootstrapInstallationState()).needsSetup) {
      return reply.code(401).send({ error: { code: "unauthorized", message: "Sign in first." } });
    }
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    const username = typeof request.body?.username === "string" ? request.body.username : "";
    return { checks: passwordChecks(password, username).map(({ id, label, ok }) => ({ id, label, ok })) };
  });

  /** The town search for the first weather panel, before any account exists. */
  app.get("/api/v1/setup/places", async (request, reply) => {
    if (!(await bootstrapInstallationState()).needsSetup) {
      return reply.code(400).send({ error: { code: "already_setup", message: "Nexternel is already set up." } });
    }
    return placeSearchReply(request, reply);
  });

  app.post<{
    Body: {
      username?: string;
      password?: string;
      confirmPassword?: string;
      displayName?: unknown;
      email?: unknown;
      termsVersion?: unknown;
      homeName?: unknown;
      place?: unknown;
      themePrefs?: unknown;
    };
  }>("/api/v1/setup/complete", async (request, reply) => {
    if (await isSetupComplete()) {
      return reply.code(400).send({
        error: { code: "already_setup", message: "Nexternel is already configured." },
      });
    }
    if ((await getUserCount()) > 0) {
      await markSetupComplete();
      return reply.code(400).send({
        error: { code: "already_setup", message: "An administrator account already exists." },
      });
    }

    const username = request.body?.username?.trim() ?? "";
    const password = request.body?.password ?? "";
    const confirmPassword = request.body?.confirmPassword ?? "";

    if (!username || username.length < 2) {
      return reply.code(400).send({
        error: { code: "bad_request", message: "Username must be at least 2 characters." },
      });
    }
    const problem = passwordProblem(password ?? "", username ?? "");
    if (problem) {
      return reply.code(400).send({ error: { code: "weak_password", message: problem } });
    }
    if (password !== confirmPassword) {
      return reply.code(400).send({
        error: { code: "bad_request", message: "Passwords do not match." },
      });
    }

    if (request.body?.termsVersion !== TERMS_VERSION) {
      return reply.code(400).send({
        error: { code: "terms_not_accepted", message: "Please read and agree to the terms of use first." },
      });
    }
    const email = parseEmail(request.body?.email);
    if (email === undefined && request.body?.email !== undefined) {
      return reply.code(400).send({ error: { code: "bad_request", message: "That email address does not look right." } });
    }
    const displayName =
      typeof request.body?.displayName === "string" ? request.body.displayName.replace(/\s+/g, " ").trim().slice(0, 100) || null : null;
    const themePrefs = parseThemePrefsInput(request.body?.themePrefs) ?? null;
    const place = setupPlace(request.body?.place);

    const pool = getPool();
    const existing = await pool.query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [
      username,
    ]);
    if ((existing.rowCount ?? 0) > 0) {
      return reply.code(400).send({
        error: { code: "bad_request", message: "That username is already in use." },
      });
    }

    const passwordHash = await hashPassword(password);
    const inserted = await pool.query<{
      id: string;
      username: string;
      display_name: string | null;
      role: string;
      theme_prefs: unknown;
      avatar_data: string | null;
    }>(
      `INSERT INTO users (username, password_hash, display_name, role, is_active, email, theme_prefs)
       VALUES ($1, $2, $3, 'admin', true, $4, COALESCE($5::jsonb, '{}'::jsonb))
       RETURNING id, username, display_name, role, theme_prefs, avatar_data`,
      // Without a name of their own, screens show the username (the role is not a name).
      [username, passwordHash, displayName, email ?? null, themePrefs ? JSON.stringify(themePrefs) : null]
    );
    const user = inserted.rows[0];
    if (!user) {
      return reply.code(500).send({
        error: { code: "setup_failed", message: "Could not create administrator account." },
      });
    }

    await markSetupComplete();
    await recordTermsAccepted(TERMS_VERSION, user.username);
    const homeName = normalizeHomeName(request.body?.homeName);
    if (homeName) await setHome({ name: homeName });
    await ensureStarterDashboard(user.id, { place }).catch((err) => {
      request.log.warn({ err }, "starter dashboard not created");
    });

    const roleInfo = await resolveRoleInfo(user.role);
    const claims = {
      userId: user.id,
      username: user.username,
      role: roleInfo.slug,
      isAdmin: roleInfo.isAdmin,
      permissions: roleInfo.permissions,
    };
    const accessToken = await signAccessToken(claims);
    const refreshToken = await signRefreshToken(claims);
    clearAuthCookies(reply);
    setAuthCookies(reply, accessToken, refreshToken);

    return {
      ok: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: roleInfo.slug,
        roleName: roleInfo.name,
        isAdmin: roleInfo.isAdmin,
        permissions: roleInfo.permissions,
        themePrefs: themePrefsFromDb(user.theme_prefs),
        avatarData: user.avatar_data ?? null,
      },
    };
  });
};
