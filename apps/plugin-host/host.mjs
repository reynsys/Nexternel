// Nexternel plugin container: runs each enabled plugin as its own process and user,
// restarts it if it stops, and reports to the API. Plugins never see the API's key.
import { spawn } from "node:child_process";
import { chmod, chown, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = (process.env.NEXTERNEL_API || "http://api:4000").replace(/\/$/, "");
const DIR = process.env.PLUGINS_DIR || "/plugins";
const RUNNER = path.join(path.dirname(fileURLToPath(import.meta.url)), "runner.mjs");
const POLL_MS = 5000;
const FIRST_UID = 20000;
const BACKOFF_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];
const STABLE_MS = 10 * 60_000;

/** @type {Map<string, {proc: import("node:child_process").ChildProcess|null, version: string, configRev: number, state: string, message: string|null, logs: object[], failures: number, startedAt: number, retryAt: number, stopping: boolean}>} */
const plugins = new Map();
let hostKey = "";

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function readHostKey() {
  for (;;) {
    try {
      const key = (await readFile(path.join(DIR, ".host-key"), "utf8")).trim();
      if (key) return key;
    } catch {
      /* the API writes it on start */
    }
    log("waiting for the API to create the plugin key…");
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function api(method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { "x-nexternel-host-key": hostKey, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) {
    hostKey = await readHostKey(); // the key file may have been re-created
    throw new Error("API refused the plugin key");
  }
  if (!res.ok) throw new Error(`${method} ${route} → ${res.status}`);
  return res.json();
}

/** Each plugin gets a fixed user id of its own, remembered across restarts. */
async function pluginUid(id) {
  const file = path.join(DIR, ".uids.json");
  let map = {};
  try {
    map = JSON.parse(await readFile(file, "utf8"));
  } catch {
    /* first plugin */
  }
  if (!map[id]) {
    const used = new Set(Object.values(map));
    let uid = FIRST_UID;
    while (used.has(uid)) uid++;
    map[id] = uid;
    await writeFile(file, JSON.stringify(map, null, 1), { mode: 0o600 });
  }
  return map[id];
}

function capture(entry, stream, chunk) {
  for (const line of chunk.toString("utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    entry.logs.push({ t: new Date().toISOString(), stream, line: line.slice(0, 1000) });
  }
  if (entry.logs.length > 200) entry.logs.splice(0, entry.logs.length - 200);
}

async function start(id, want) {
  const entry = plugins.get(id) ?? { proc: null, logs: [], failures: 0, retryAt: 0 };
  Object.assign(entry, { version: want.version, configRev: want.configRev, state: "starting", message: null, stopping: false });
  plugins.set(id, entry);
  const folder = path.join(DIR, want.folder);
  const main = path.join(folder, want.main);
  if (!main.startsWith(folder + path.sep)) throw new Error("plugin main is outside its folder");
  const uid = await pluginUid(id);
  const dataDir = path.join(DIR, "data", id);
  await mkdir(dataDir, { recursive: true });
  await chown(dataDir, uid, uid);
  await chmod(dataDir, 0o700);
  const { token } = await api("POST", `/api/v1/plugin-host/start/${encodeURIComponent(id)}`);
  const proc = spawn(process.execPath, ["--max-old-space-size=256", RUNNER], {
    cwd: folder,
    uid,
    gid: uid,
    env: {
      PATH: process.env.PATH,
      TZ: process.env.TZ || "UTC",
      HOME: dataDir,
      NODE_ENV: "production",
      NEXTERNEL_API: API,
      NEXTERNEL_PLUGIN_ID: id,
      NEXTERNEL_PLUGIN_TOKEN: token,
      NEXTERNEL_PLUGIN_MAIN: main,
      NEXTERNEL_PLUGIN_DATA: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  entry.proc = proc;
  entry.startedAt = Date.now();
  entry.state = "running";
  proc.stdout.on("data", (c) => capture(entry, "stdout", c));
  proc.stderr.on("data", (c) => capture(entry, "stderr", c));
  proc.on("exit", (code, signal) => {
    entry.proc = null;
    if (entry.stopping) {
      entry.state = "stopped";
      return;
    }
    // A run that lasted a while resets the back-off.
    if (Date.now() - entry.startedAt > STABLE_MS) entry.failures = 0;
    const wait = BACKOFF_MS[Math.min(entry.failures, BACKOFF_MS.length - 1)];
    entry.failures += 1;
    entry.retryAt = Date.now() + wait;
    entry.state = "crashed";
    entry.message = `Stopped unexpectedly (${signal ?? `exit code ${code}`}); trying again in ${Math.round(wait / 1000)} s`;
    log(id, entry.message);
  });
  log(id, `started ${want.version} as user ${uid}`);
}

function stop(id, entry) {
  entry.stopping = true;
  const proc = entry.proc;
  if (!proc) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => proc.kill("SIGKILL"), 5000);
    proc.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    proc.kill("SIGTERM");
  });
}

async function cycle() {
  const { plugins: desired } = await api("GET", "/api/v1/plugin-host/desired");
  const wanted = new Map(desired.map((p) => [p.id, p]));
  for (const [id, entry] of plugins) {
    const want = wanted.get(id);
    if (!want) {
      if (entry.proc) {
        log(id, "stopping (switched off or removed)");
        await stop(id, entry);
      }
      entry.state = "stopped";
      continue;
    }
    if (entry.proc && (want.version !== entry.version || want.configRev !== entry.configRev)) {
      log(id, "restarting with new version or settings");
      await stop(id, entry);
      entry.failures = 0;
      entry.retryAt = 0;
    }
  }
  for (const [id, want] of wanted) {
    const entry = plugins.get(id);
    if (entry?.proc) continue;
    if (entry && Date.now() < entry.retryAt) continue;
    try {
      await start(id, want);
    } catch (err) {
      const e = plugins.get(id);
      if (e) {
        e.state = "crashed";
        e.message = `Could not start: ${err.message}`;
        e.retryAt = Date.now() + 30_000;
      }
      log(id, "could not start:", err.message);
    }
  }
  const report = [];
  for (const [id, entry] of plugins) {
    report.push({ id, state: entry.state, message: entry.message, logs: entry.logs.splice(0) });
    if (entry.state === "stopped" && !wanted.has(id)) plugins.delete(id);
  }
  if (report.length) await api("POST", "/api/v1/plugin-host/report", { plugins: report });
}

async function main() {
  hostKey = await readHostKey();
  log(`plugin container ready (API ${API})`);
  for (;;) {
    try {
      await cycle();
    } catch (err) {
      log("cannot reach the API:", err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    await Promise.all([...plugins].map(([id, e]) => stop(id, e)));
    process.exit(0);
  });
}

main();
