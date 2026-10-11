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
import { refreshHostIp } from "../system/host-ip.js";

/** Restores started from the welcome screen — their progress stays readable once accounts exist. */
const welcomeRestoreJobs = new Set<string>();

function welcomeRestoreRunning(): boolean {
  for (const id of welcomeRestoreJobs) {
    const status = getJob(id)?.status;
    if (status && status !== "completed" && status !== "failed") return true;
  }
  return false;
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
      const inspect = await inspectBackupFile(fileBuffer, password);
      if (!inspect.valid || !inspect.compatible) {
        return reply.code(400).send({
          error: { code: "backup_invalid", message: inspect.blockingErrors.join(" ") || "This backup cannot be restored." },
        });
      }
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
      installationReady: !state.needsSetup,
    };
  });

  app.post<{
    Body: { username?: string; password?: string; confirmPassword?: string };
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
    if (!password || password.length < 8) {
      return reply.code(400).send({
        error: { code: "bad_request", message: "Password must be at least 8 characters." },
      });
    }
    if (password !== confirmPassword) {
      return reply.code(400).send({
        error: { code: "bad_request", message: "Passwords do not match." },
      });
    }

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
      display_name: string;
      role: string;
      theme_prefs: unknown;
      avatar_data: string | null;
    }>(
      `INSERT INTO users (username, password_hash, display_name, role, is_active)
       VALUES ($1, $2, $3, 'admin', true)
       RETURNING id, username, display_name, role, theme_prefs, avatar_data`,
      [username, passwordHash, "Administrator"]
    );
    const user = inserted.rows[0];
    if (!user) {
      return reply.code(500).send({
        error: { code: "setup_failed", message: "Could not create administrator account." },
      });
    }

    await markSetupComplete();
    await ensureStarterDashboard(user.id).catch((err) => {
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
