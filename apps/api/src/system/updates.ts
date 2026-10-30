import { execFile } from "child_process";
import { mkdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import { getPool } from "../db.js";
import { addNotification } from "../notifications/service.js";
import { bellTopicOn } from "../notifications/topics.js";
import { nexternelVersionAtLeast } from "../plugins/validate.js";
import { APP_VERSION } from "../version.js";

/**
 * Updates from inside Nexternel: check GitHub for a newer release (daily and on request),
 * download it, and install it with the release's own update script. The update runs in a
 * separate short-lived container, because it rebuilds and restarts this one.
 */
const execFileAsync = promisify(execFile);

const RELEASES_API = "https://api.github.com/repos/reynsys/Nexternel/releases/latest";
/** Nexternel looks for a new version every night at this local time (and when asked). */
export const NIGHTLY_CHECK = { hour: 1, minute: 15 };
const UPDATER_IMAGE = "docker:27.5.1-cli";
const UPDATER_NAME = "nexternel-updater";

function feedUrl(): string {
  return process.env.UPDATE_FEED_URL || RELEASES_API;
}

function backupsDir(): string {
  return process.env.BACKUPS_DIR || "/backups";
}

function updatesDir(): string {
  return path.join(backupsDir(), "updates");
}

export type ReleaseInfo = {
  version: string;
  notes: string;
  publishedAt: string | null;
  downloadUrl: string;
  sha256: string | null;
  size: number | null;
};

export type UpdateStatus = {
  current: string;
  latest: ReleaseInfo | null;
  updateAvailable: boolean;
  lastCheckedAt: string | null;
  lastCheckError: string | null;
  downloaded: string | null;
  /** idle | updating | succeeded | failed */
  run: {
    state: "idle" | "updating" | "succeeded" | "failed";
    target: string | null;
    startedAt: string | null;
    step: string | null;
    log: string;
  };
  /** Local time of the nightly check, "01:15". */
  nightlyCheck: string;
  canUpdate: boolean;
};

type Row = {
  last_check_at: Date | null;
  last_error: string | null;
  latest: ReleaseInfo | null;
  notified_version: string | null;
  downloaded_version: string | null;
  run_target: string | null;
  run_started_at: Date | null;
};

export async function ensureUpdateSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS system_update (
      id                 INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      last_check_at      TIMESTAMPTZ,
      last_error         TEXT,
      latest             JSONB,
      notified_version   VARCHAR(20),
      downloaded_version VARCHAR(20),
      run_target         VARCHAR(20)
    );
    ALTER TABLE system_update ADD COLUMN IF NOT EXISTS run_started_at TIMESTAMPTZ;
    INSERT INTO system_update (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  `);
}

async function getRow(): Promise<Row> {
  const res = await getPool().query<Row>(
    `SELECT last_check_at, last_error, latest, notified_version, downloaded_version, run_target, run_started_at FROM system_update WHERE id = 1`
  );
  return res.rows[0]!;
}

async function setRow(fields: Partial<Record<keyof Row, unknown>>): Promise<void> {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 1}${k === "latest" ? "::jsonb" : ""}`);
  const values = keys.map((k) => (k === "latest" && fields[k] !== null ? JSON.stringify(fields[k]) : fields[k as keyof Row]));
  await getPool().query(`UPDATE system_update SET ${sets.join(", ")} WHERE id = 1`, values);
}

const isNewer = (v: string) => v !== APP_VERSION && nexternelVersionAtLeast(v, APP_VERSION);

function packageFile(version: string): string {
  return path.join(updatesDir(), `nexternel-${version}.tar.gz`);
}

/** Ask GitHub for the newest release. Tells the bell once per new version. */
export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    const res = await fetch(feedUrl(), {
      headers: { accept: "application/vnd.github+json", "user-agent": `Nexternel/${APP_VERSION}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const r = (await res.json()) as {
      tag_name?: string;
      body?: string;
      published_at?: string;
      assets?: { name: string; browser_download_url: string; size?: number; digest?: string }[];
    };
    const version = r.tag_name ?? "";
    const asset = r.assets?.find((a) => a.name === "nexternel.tar.gz");
    if (!/^V\d+\.\d+\.\d+$/.test(version) || !asset) throw new Error("The newest release has no Nexternel download");
    const latest: ReleaseInfo = {
      version,
      notes: (r.body ?? "").replace(/\r/g, "").trim(),
      publishedAt: r.published_at ?? null,
      downloadUrl: asset.browser_download_url,
      sha256: asset.digest?.startsWith("sha256:") ? asset.digest.slice(7) : null,
      size: asset.size ?? null,
    };
    const row = await getRow();
    await setRow({ last_check_at: new Date(), last_error: null, latest });
    if (isNewer(version) && row.notified_version !== version && (await bellTopicOn("updates"))) {
      await addNotification({
        source: "system",
        sourceName: "Nexternel",
        level: "info",
        title: `Nexternel ${version} is available`,
        body: "Install it from Settings → System → Updates.",
      });
      await setRow({ notified_version: version });
    }
  } catch (err) {
    await setRow({ last_check_at: new Date(), last_error: err instanceof Error ? err.message : String(err) });
  }
  return updateStatus();
}

/** Download the newest release next to the backups and check it is a complete Nexternel package. */
export async function downloadUpdate(): Promise<UpdateStatus> {
  const row = await getRow();
  const latest = row.latest;
  if (!latest || !isNewer(latest.version)) throw new Error("There is no newer version to download. Check for updates first.");
  await mkdir(updatesDir(), { recursive: true });
  const file = packageFile(latest.version);
  const partial = `${file}.part`;
  const res = await fetch(latest.downloadUrl, { redirect: "follow", signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  // About 1 MB: read it whole (streaming to disk hit a crash in Node's fetch on some servers).
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length > 200 * 1024 * 1024) throw new Error("The download is unexpectedly large.");
  await writeFile(partial, data);
  try {
    if (latest.sha256) {
      const { createHash } = await import("crypto");
      const sum = createHash("sha256").update(data).digest("hex");
      if (sum !== latest.sha256) throw new Error("The download is damaged (checksum differs). Try again.");
    }
    const { stdout } = await execFileAsync("tar", ["-xzOf", partial, "nexternel/VERSION"], { timeout: 60_000 });
    if (stdout.trim() !== latest.version) throw new Error(`The download is not ${latest.version} (it says ${stdout.trim() || "nothing"}).`);
    await execFileAsync("tar", ["-xzOf", partial, "nexternel/scripts/update.sh"], { timeout: 60_000, maxBuffer: 10_000_000 });
  } catch (err) {
    await rm(partial, { force: true });
    throw err instanceof Error && err.message.startsWith("The download") ? err : new Error("The download is not a complete Nexternel package. Try again.");
  }
  await rename(partial, file);
  // Only the newest download is kept.
  for (const f of await listUpdateFiles()) if (f !== path.basename(file)) await rm(path.join(updatesDir(), f), { force: true });
  await setRow({ downloaded_version: latest.version });
  return updateStatus();
}

async function listUpdateFiles(): Promise<string[]> {
  const { readdir } = await import("fs/promises");
  try {
    return (await readdir(updatesDir())).filter((f) => /^nexternel-V[\d.]+\.tar\.gz(\.part)?$/.test(f));
  } catch {
    return [];
  }
}

/** The Nexternel folder on the server, found from where this container's backups folder comes from. */
async function hostFolder(): Promise<string> {
  const { stdout } = await execFileAsync("docker", ["inspect", "nexternel-api", "--format", "{{json .Mounts}}"], { timeout: 20_000 });
  const mounts = JSON.parse(stdout) as { Source: string; Destination: string }[];
  const backups = mounts.find((m) => m.Destination === backupsDir());
  if (!backups) throw new Error("Cannot find the Nexternel folder on the server.");
  return path.dirname(backups.Source);
}

async function updaterRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("docker", ["ps", "--filter", `name=^${UPDATER_NAME}$`, "--format", "{{.Names}}"], { timeout: 10_000 });
    return stdout.trim() === UPDATER_NAME;
  } catch {
    return false;
  }
}

function logFile(): string {
  return path.join(updatesDir(), "update.log");
}

/**
 * Start the update in its own container: it unpacks the release's update script into the
 * Nexternel folder and runs it (settings copy, rebuild, automatic return to this version on failure).
 */
export async function startUpdate(): Promise<UpdateStatus> {
  if (process.env.ALLOW_DOCKER_RESTART !== "true") throw new Error("Updating from Nexternel is not enabled on this server.");
  if (await updaterRunning()) throw new Error("An update is already running.");
  const row = await getRow();
  const version = row.downloaded_version;
  if (!version || !isNewer(version)) throw new Error("Download the new version first.");
  try {
    await stat(packageFile(version));
  } catch {
    await setRow({ downloaded_version: null });
    throw new Error("The downloaded file is missing. Download it again.");
  }
  const host = await hostFolder();
  const pkg = `backups/updates/nexternel-${version}.tar.gz`;
  const log = "backups/updates/update.log";
  // The update runs as root to rebuild containers; afterwards everything it wrote goes back to
  // whoever owns the Nexternel files, so copying files and running commands by hand keep working.
  const script = [
    "set -u",
    `exec > ${log} 2>&1`,
    'OWNER=$(stat -c %u:%g docker-compose.yml)',
    `echo "Updating to ${version}…"`,
    "apk add --no-cache -q bash curl coreutils tar >/dev/null",
    `tar -xzOf ${pkg} nexternel/scripts/update.sh > scripts/update.sh.new && mv scripts/update.sh.new scripts/update.sh && chmod +x scripts/update.sh`,
    `NEXTERNEL_SOURCE="$PWD/${pkg}" bash scripts/update.sh`,
    "code=$?",
    'chown "$OWNER" . backups backups/updates 2>/dev/null',
    'chown -R "$OWNER" apps packages db scripts backups/updates 2>/dev/null',
    '[ -f .release-files ] && while IFS= read -r f; do [ -e "$f" ] && chown "$OWNER" "$f"; done < .release-files',
    'chown "$OWNER" .release-files VERSION backups/pre-update-* 2>/dev/null',
    'echo "UPDATE-EXIT $code"',
  ].join("\n");
  await mkdir(updatesDir(), { recursive: true });
  await rm(logFile(), { force: true });
  await execFileAsync(
    "docker",
    [
      "run", "-d", "--rm", "--name", UPDATER_NAME, "--network", "host",
      "-v", "/var/run/docker.sock:/var/run/docker.sock",
      "-v", `${host}:${host}`, "-w", host,
      UPDATER_IMAGE, "sh", "-c", script,
    ],
    { timeout: 5 * 60_000 }
  );
  await setRow({ run_target: version, run_started_at: new Date() });
  const { clearMaintenanceCache } = await import("./maintenance.js");
  clearMaintenanceCache();
  return updateStatus();
}

// An update that has not finished after this long has stopped without saying so.
const UPDATE_GIVE_UP_MS = 45 * 60_000;

async function readLog(): Promise<string> {
  try {
    return (await readFile(logFile(), "utf8")).replace(/\x1b\[[0-9;]*m/g, "");
  } catch {
    return "";
  }
}

/** The step the update is on, from the update script's "==>" lines. */
function currentStep(log: string): string | null {
  const steps = log.split("\n").filter((l) => l.startsWith("==> ")).map((l) => l.slice(4).trim());
  return steps.at(-1) ?? (log.trim() ? "Preparing…" : null);
}

async function runState(row: Row, log: string): Promise<UpdateStatus["run"]["state"]> {
  if (!row.run_target) return "idle";
  if (row.run_target === APP_VERSION) return "succeeded";
  const exit = /UPDATE-EXIT (\d+)/.exec(log);
  if (exit) return exit[1] === "0" ? "succeeded" : "failed";
  if (row.run_started_at && Date.now() - row.run_started_at.getTime() > UPDATE_GIVE_UP_MS) return "failed";
  return (await updaterRunning()) ? "updating" : "failed";
}

/** For maintenance mode: is an update running, to which version, since when. */
export async function updateRunInfo(): Promise<{ state: UpdateStatus["run"]["state"]; target: string | null; since: string | null }> {
  const row = await getRow();
  if (!row.run_target) return { state: "idle", target: null, since: null };
  return { state: await runState(row, await readLog()), target: row.run_target, since: row.run_started_at?.toISOString() ?? null };
}

export async function updateStatus(): Promise<UpdateStatus> {
  const row = await getRow();
  const log = await readLog();
  const state = await runState(row, log);
  const latest = row.latest;
  const downloaded =
    row.downloaded_version && isNewer(row.downloaded_version) ? row.downloaded_version : null;
  return {
    current: APP_VERSION,
    latest,
    updateAvailable: Boolean(latest && isNewer(latest.version)),
    lastCheckedAt: row.last_check_at ? row.last_check_at.toISOString() : null,
    lastCheckError: row.last_error,
    downloaded,
    // The update script colours its output for terminals; strip that for the page.
    run: {
      state,
      target: row.run_target,
      startedAt: row.run_started_at ? row.run_started_at.toISOString() : null,
      step: currentStep(log),
      log: log.split("\n").slice(-40).join("\n"),
    },
    nightlyCheck: `${String(NIGHTLY_CHECK.hour).padStart(2, "0")}:${String(NIGHTLY_CHECK.minute).padStart(2, "0")}`,
    canUpdate: process.env.ALLOW_DOCKER_RESTART === "true",
  };
}

/** Clear a finished update from the screen. */
export async function dismissUpdateRun(): Promise<UpdateStatus> {
  if (await updaterRunning()) throw new Error("The update is still running.");
  await setRow({ run_target: null });
  if ((await getRow()).downloaded_version === APP_VERSION) await setRow({ downloaded_version: null });
  return updateStatus();
}

/** The most recent nightly check time that has passed (local time). */
export function lastNightlySlot(now = new Date()): Date {
  const slot = new Date(now);
  slot.setHours(NIGHTLY_CHECK.hour, NIGHTLY_CHECK.minute, 0, 0);
  if (slot > now) slot.setDate(slot.getDate() - 1);
  return slot;
}

/** Check every night at 01:15 (or as soon as Nexternel is running again after that time). */
export function startUpdateChecks(): void {
  const tick = async () => {
    try {
      const row = await getRow();
      if (!row.last_check_at || row.last_check_at < lastNightlySlot()) await checkForUpdate();
      // A finished update: the new version is running, so its download is no longer needed.
      if (row.downloaded_version && !isNewer(row.downloaded_version)) {
        await rm(packageFile(row.downloaded_version), { force: true });
        await setRow({ downloaded_version: null });
      }
    } catch {
      /* try again on the next tick */
    }
  };
  setTimeout(() => void tick(), 60_000).unref?.();
  setInterval(() => void tick(), 5 * 60_000).unref?.();
}
