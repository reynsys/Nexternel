import { markRestore } from "../system/maintenance.js";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { backupJobsDir } from "./paths.js";
import type { BackupJob, BackupJobPhase, BackupManifest, RestoreResult } from "./types.js";

const JOB_TTL_MS = 24 * 60 * 60 * 1000;

const jobs = new Map<string, BackupJob>();

function jobPath(id: string): string {
  return path.join(backupJobsDir(), `${id}.json`);
}

function filePath(id: string): string {
  return path.join(backupJobsDir(), `${id}.nexbackup`);
}

function safetyPath(id: string): string {
  return path.join(backupJobsDir(), `${id}-safety.nexbackup`);
}

function persist(job: BackupJob) {
  fs.writeFileSync(jobPath(job.id), JSON.stringify(job, null, 2));
}

function loadJob(id: string): BackupJob | null {
  const mem = jobs.get(id);
  if (mem) return mem;
  const p = jobPath(id);
  if (!fs.existsSync(p)) return null;
  try {
    const job = JSON.parse(fs.readFileSync(p, "utf8")) as BackupJob;
    jobs.set(id, job);
    return job;
  } catch {
    return null;
  }
}

function pruneExpired() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    const created = Date.parse(job.createdAt);
    if (Number.isFinite(created) && now - created > JOB_TTL_MS) {
      jobs.delete(id);
      for (const p of [jobPath(id), filePath(id), safetyPath(id)]) {
        try {
          fs.unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
    }
  }
}

export function createJob(type: BackupJob["type"]): BackupJob {
  pruneExpired();
  const job: BackupJob = {
    id: randomUUID(),
    type,
    status: "queued",
    percent: 0,
    message: type === "create" ? "Queued" : "Queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  persist(job);
  // Restores switch maintenance mode on until they finish.
  if (type === "restore") markRestore(job.id, true);
  return job;
}

export function getJob(id: string): BackupJob | null {
  return loadJob(id);
}

export function updateJob(
  id: string,
  patch: Partial<Pick<BackupJob, "status" | "percent" | "message" | "filename" | "manifest" | "error" | "downloadExpiresAt" | "restoreResult">>
): BackupJob | null {
  const job = loadJob(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  persist(job);
  if (job.type === "restore") markRestore(job.id, !["completed", "failed", "expired", "ready"].includes(job.status));
  return job;
}

export function saveJobFile(id: string, buffer: Buffer): void {
  fs.writeFileSync(filePath(id), buffer);
  const expires = new Date(Date.now() + JOB_TTL_MS).toISOString();
  updateJob(id, { downloadExpiresAt: expires });
}

export function readJobFile(id: string): Buffer | null {
  const p = filePath(id);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

export function saveSafetySnapshot(id: string, buffer: Buffer): void {
  fs.writeFileSync(safetyPath(id), buffer);
}

export function jobFileExists(id: string): boolean {
  return fs.existsSync(filePath(id));
}

export function phasePercent(phase: BackupJobPhase): number {
  const map: Record<BackupJobPhase, number> = {
    queued: 0,
    collecting_home: 15,
    collecting_esphome: 35,
    collecting_automations: 50,
    collecting_history: 70,
    packaging: 85,
    encrypting: 92,
    verifying: 97,
    ready: 100,
    restoring_home: 20,
    restoring_esphome: 40,
    adapting_network: 52,
    restoring_automations: 60,
    restoring_history: 75,
    syncing: 88,
    completed: 100,
    failed: 0,
    expired: 0,
  };
  return map[phase] ?? 0;
}

export type { BackupManifest, RestoreResult };
