import type { FastifyPluginAsync } from "fastify";
import { requireAdmin } from "../auth/rbac.js";
import {
  createJob,
  getJob,
  readJobFile,
  updateJob,
} from "./jobs.js";
import {
  inspectBackupFile,
  mapBackupError,
  runCreateBackupJob,
  runRestoreBackupJob,
} from "./restore-service.js";
import fs from "fs";
import { readBackupUpload } from "./upload.js";
import { config } from "../config.js";
import {
  emergencyKitText,
  getBackupKey,
  getBackupSchedule,
  listStoredBackups,
  runStoredBackup,
  storedBackupPath,
  updateBackupSchedule,
} from "./scheduled.js";

export const backupRoutes: FastifyPluginAsync = async (app) => {
  /** Automatic backups: settings, last result, and the backups kept on this server. */
  app.get("/api/v1/backup/schedule", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    return { schedule: await getBackupSchedule(), files: listStoredBackups() };
  });

  app.put<{ Body: { enabled?: boolean; hour?: number; keep?: number; includeHistory?: boolean } }>(
    "/api/v1/backup/schedule",
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return;
      const b = request.body ?? {};
      const schedule = await updateBackupSchedule({
        enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
        hour: typeof b.hour === "number" ? b.hour : undefined,
        keep: typeof b.keep === "number" ? b.keep : undefined,
        includeHistory: typeof b.includeHistory === "boolean" ? b.includeHistory : undefined,
      });
      return { schedule, files: listStoredBackups() };
    }
  );

  /** "Back up now" into the backups folder, encrypted with the installation key. */
  app.post("/api/v1/backup/stored", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const result = await runStoredBackup("manual");
    if (!result.ok) {
      return reply.code(500).send({ error: { code: "backup_failed", message: result.message } });
    }
    return { result, schedule: await getBackupSchedule(), files: listStoredBackups() };
  });

  app.get<{ Params: { name: string } }>("/api/v1/backup/stored/:name", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const file = storedBackupPath(request.params.name);
    if (!file) return reply.code(404).send({ error: { code: "not_found", message: "Backup not found." } });
    return reply
      .header("Content-Type", "application/octet-stream")
      .header("Content-Disposition", `attachment; filename="${request.params.name}"`)
      .send(fs.createReadStream(file));
  });

  app.delete<{ Params: { name: string } }>("/api/v1/backup/stored/:name", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const file = storedBackupPath(request.params.name);
    if (!file) return reply.code(404).send({ error: { code: "not_found", message: "Backup not found." } });
    fs.rmSync(file, { force: true });
    return { files: listStoredBackups() };
  });

  /** Restore a backup from the backups folder (opened with the installation key). */
  app.post<{ Params: { name: string }; Body: { confirm?: string } }>(
    "/api/v1/backup/stored/:name/restore",
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return;
      if (request.body?.confirm !== "RESTORE") {
        return reply.code(400).send({
          error: { code: "bad_request", message: "Confirmation required: type RESTORE to continue." },
        });
      }
      const file = storedBackupPath(request.params.name);
      if (!file) return reply.code(404).send({ error: { code: "not_found", message: "Backup not found." } });
      try {
        const buffer = fs.readFileSync(file);
        const password = await getBackupKey();
        const inspect = await inspectBackupFile(buffer, password);
        if (!inspect.valid || !inspect.compatible) {
          return reply.code(400).send({
            error: { code: "backup_invalid", message: inspect.blockingErrors.join(" ") || "Invalid backup." },
          });
        }
        const job = createJob("restore");
        updateJob(job.id, { status: "queued", message: "Starting restore" });
        void runRestoreBackupJob(job.id, buffer, password, {
          preserveAdminUsername: request.user?.username,
        });
        return { job };
      } catch (err) {
        return reply.code(400).send({ error: mapBackupError(err) });
      }
    }
  );

  /** The backup key as a file to keep off the server — needed to restore automatic backups. */
  app.get("/api/v1/backup/emergency-kit", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const text = emergencyKitText(await getBackupKey(), config.serverIp() || null);
    return reply
      .header("Content-Type", "text/plain; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="nexternel-emergency-kit.txt"`)
      .send(text);
  });

  app.post<{
    Body: {
      password?: string;
      confirmPassword?: string;
      includeHistory?: boolean;
    };
  }>("/api/v1/backup/jobs", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;

    const password = String(request.body?.password ?? "").trim();
    const confirmPassword = String(request.body?.confirmPassword ?? "").trim();
    const includeHistory = request.body?.includeHistory !== false;

    if (!password || password.length < 8) {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: "Backup password must be at least 8 characters.",
        },
      });
    }
    if (password !== confirmPassword) {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: "Backup passwords do not match.",
        },
      });
    }

    const job = createJob("create");
    void runCreateBackupJob(job.id, password, includeHistory);
    return { job };
  });

  app.get<{ Params: { id: string } }>(
    "/api/v1/backup/jobs/:id",
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return;
      const job = getJob(request.params.id);
      if (!job) {
        return reply.code(404).send({
          error: { code: "not_found", message: "Backup job not found." },
        });
      }
      return { job };
    }
  );

  app.get<{ Params: { id: string } }>(
    "/api/v1/backup/jobs/:id/download",
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return;
      const job = getJob(request.params.id);
      if (!job || job.status !== "ready") {
        return reply.code(404).send({
          error: { code: "not_found", message: "Backup is not ready for download." },
        });
      }
      const buffer = readJobFile(request.params.id);
      if (!buffer) {
        return reply.code(404).send({
          error: { code: "not_found", message: "Backup file not found." },
        });
      }
      const filename = job.filename || "nexternel-backup.nexbackup";
      return reply
        .header("Content-Type", "application/octet-stream")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buffer);
    }
  );

  app.post("/api/v1/backup/inspect", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;

    try {
      const { fileBuffer, fields } = await readBackupUpload(request);
      const password = fields.password ?? "";

      if (!fileBuffer?.length) {
        return reply.code(400).send({
          error: { code: "bad_request", message: "Backup file is required." },
        });
      }
      if (!password) {
        return reply.code(400).send({
          error: { code: "bad_request", message: "Backup password is required." },
        });
      }

      const result = await inspectBackupFile(fileBuffer, password);
      return result;
    } catch (err) {
      const mapped = mapBackupError(err);
      return reply.code(400).send({ error: mapped });
    }
  });

  app.post("/api/v1/backup/restore", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;

    try {
      const { fileBuffer, fields } = await readBackupUpload(request);
      const password = fields.password ?? "";
      const confirm = fields.confirm ?? "";
      const wifiSsid = fields.wifiSsid ?? "";
      const wifiPassword = fields.wifiPassword ?? "";

      if (!fileBuffer?.length) {
        return reply.code(400).send({
          error: { code: "bad_request", message: "Backup file is required." },
        });
      }
      if (!password) {
        return reply.code(400).send({
          error: { code: "bad_request", message: "Backup password is required." },
        });
      }
      if (confirm !== "RESTORE") {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: 'Confirmation required: type RESTORE to continue.',
          },
        });
      }

      const inspect = await inspectBackupFile(fileBuffer, password);
      if (!inspect.valid) {
        const msg = inspect.blockingErrors[0] || "Invalid backup.";
        const code =
          msg.includes("password") ? "backup_password_invalid" : "backup_corrupt";
        return reply.code(400).send({ error: { code, message: msg } });
      }
      if (!inspect.compatible) {
        return reply.code(400).send({
          error: {
            code: "backup_incompatible",
            message: inspect.blockingErrors.join(" "),
          },
        });
      }

      const job = createJob("restore");
      updateJob(job.id, { status: "queued", message: "Starting restore" });
      void runRestoreBackupJob(job.id, fileBuffer, password, {
        wifiSsid: wifiSsid || undefined,
        wifiPassword: wifiPassword || undefined,
        preserveAdminUsername: request.user?.username,
      });
      return { job };
    } catch (err) {
      const mapped = mapBackupError(err);
      return reply.code(400).send({ error: mapped });
    }
  });
};
