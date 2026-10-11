import fs from "fs";
import path from "path";

export function backupJobsDir(): string {
  const dir = process.env.BACKUP_JOBS_DIR || "/backup-jobs";
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function mosquittoConfigDir(): string {
  return process.env.MOSQUITTO_CONFIG_DIR || "/mosquitto-config";
}

export function influxBackupCli(): string {
  return process.env.INFLUX_BACKUP_CLI || "influx";
}
