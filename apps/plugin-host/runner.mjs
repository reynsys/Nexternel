// Runs one plugin (as that plugin's own user). The plugin's main file exports
//   export default async function start(nx) { … }
// and may return a function that is called when the plugin is stopped.
import { pathToFileURL } from "node:url";

const API = process.env.NEXTERNEL_API;
const TOKEN = process.env.NEXTERNEL_PLUGIN_TOKEN;
const MAIN = process.env.NEXTERNEL_PLUGIN_MAIN;
// Do not leave the token where the plugin's own code would trip over it in logs.
delete process.env.NEXTERNEL_PLUGIN_TOKEN;

class NexternelError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function call(method, route, body) {
  const res = await fetch(`${API}/api/v1/plugin-api${route}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(40_000),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // This run's token was replaced (plugin restarted or switched off): stop quietly.
    console.log("Stopped by Nexternel (restarting, or switched off).");
    process.exit(0);
  }
  if (!res.ok) throw new NexternelError(res.status, data?.error?.message ?? `${method} ${route} failed (${res.status})`);
  return data;
}

const commandHandlers = [];
const panelHandlers = [];

/** Lets a plugin write its answer bit by bit; Nexternel shows it as it grows. */
function panelAnswer(id) {
  let last = 0;
  let pending = null;
  let finished = false;
  const send = (body) => call("POST", `/panel-replies/${id}`, body).catch((err) => console.error("Could not send answer:", err.message));
  return {
    write(textSoFar) {
      if (finished) return;
      pending = textSoFar;
      const wait = Math.max(0, 400 - (Date.now() - last));
      if (wait === 0) {
        last = Date.now();
        send({ text: pending });
        pending = null;
      } else if (!this._timer) {
        this._timer = setTimeout(() => {
          this._timer = null;
          if (pending !== null && !finished) {
            last = Date.now();
            send({ text: pending });
            pending = null;
          }
        }, wait);
      }
    },
    done(finalText) {
      if (finished) return;
      finished = true;
      clearTimeout(this._timer);
      return send({ text: finalText, done: true });
    },
    fail(message) {
      if (finished) return;
      finished = true;
      clearTimeout(this._timer);
      return send({ error: String(message || "Something went wrong") });
    },
  };
}
let pending = [];
let flushTimer = null;

function flushReadings() {
  flushTimer = null;
  const batch = pending.splice(0, 500);
  if (!batch.length) return;
  call("POST", "/readings", { readings: batch })
    .then((r) => {
      if (r.unknown?.length) console.error("Nexternel does not know these items (define them first):", r.unknown.join(", "));
    })
    .catch((err) => console.error("Could not send readings:", err.message));
  if (pending.length) flushTimer = setTimeout(flushReadings, 200);
}

async function listen() {
  for (;;) {
    try {
      const { events } = await call("GET", "/events?wait=25");
      for (const ev of events ?? []) {
        if (ev.type === "panel-request") {
          const handler = panelHandlers.find((h) => h.panel === ev.panel);
          const answer = panelAnswer(ev.id);
          if (!handler) {
            answer.fail("This plugin cannot answer on this panel.");
            continue;
          }
          // Answers can take a while; do not hold up other messages (such as switch presses).
          Promise.resolve()
            .then(() => handler.fn({ text: ev.text, history: ev.history, user: ev.user }, answer))
            .catch((err) => answer.fail(err?.message ?? err));
          continue;
        }
        if (ev.type !== "command") continue;
        const cmd = { device: ev.deviceKey, item: ev.itemKey, action: ev.action };
        for (const handler of commandHandlers) {
          try {
            await handler(cmd);
          } catch (err) {
            console.error("Command handler failed:", err?.message ?? err);
          }
        }
      }
    } catch (err) {
      console.error("Waiting for Nexternel:", err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

const self = await call("GET", "/self");

/** What a plugin gets. Everything goes through the doorway and is checked there. */
const nx = Object.freeze({
  id: self.id,
  version: self.version,
  nexternelVersion: self.nexternelVersion,
  /** Values from the plugin's settings page (secrets included). */
  settings: Object.freeze({ ...self.settings }),
  /** What the person approved. */
  grants: Object.freeze({ ...self.grants }),
  /** A folder only this plugin can read and write. */
  dataDir: process.env.NEXTERNEL_PLUGIN_DATA,

  log: (...args) => console.log(...args),

  /** Declare this plugin's devices: [{ key, name, items: [{ key, name, kind, unit, control }] }]. */
  defineDevices: (devices) => call("PUT", "/devices", { devices }),
  /** Send one reading; readings are grouped and sent together. Resend at least every 2 minutes. */
  sendReading(device, item, value) {
    pending.push({ device, item, value });
    if (!flushTimer) flushTimer = setTimeout(flushReadings, 200);
  },
  /** Called when someone presses one of this plugin's switches: ({ device, item, action }) */
  onCommand(handler) {
    commandHandlers.push(handler);
  },

  /**
   * Answer questions typed on one of this plugin's conversation panels:
   * handler({ text, history, user }, answer) — call answer.write(textSoFar) as it grows,
   * then answer.done(finalText), or answer.fail(message).
   */
  onPanelRequest(panelId, handler) {
    panelHandlers.push({ panel: panelId, fn: handler });
  },
  /** Replace what one of this plugin's text panels shows. */
  setPanelContent: (panelId, { title = "", body = "" }) => call("PUT", `/panels/${encodeURIComponent(panelId)}/content`, { title, body }),

  /** Current readings this plugin may see. */
  readings: () => call("GET", "/capabilities").then((r) => r.capabilities),
  /** History for up to 24 items: range "1h" | "6h" | "24h" | "7d". */
  history: (ids, range = "24h") =>
    call("GET", `/history?ids=${encodeURIComponent(ids.join(","))}&range=${range}`).then((r) => r.series),
  /** Switch a device this plugin was allowed to control: action "on" | "off" | "toggle". */
  control: (capabilityId, action) => call("POST", "/control", { capabilityId, action }),

  /** Add a message to Nexternel's notifications: level "info" | "warning" | "alert". */
  notify: ({ title, body = "", level = "info" }) => call("POST", "/notify", { title, body, level }),
  /** Short status line under Settings → Extensions: state "ok" | "warning" | "error". */
  status: (state, message) => call("POST", "/status", { state, message }),
});

let stopPlugin = null;
process.on("SIGTERM", async () => {
  try {
    if (typeof stopPlugin === "function") await stopPlugin();
  } finally {
    flushReadings();
    setTimeout(() => process.exit(0), 300);
  }
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled error in plugin:", err?.stack ?? err);
});

const mod = await import(pathToFileURL(MAIN).href);
if (typeof mod.default !== "function") {
  console.error("The plugin's main file must export a default function start(nx).");
  process.exit(2);
}
// start() sets things up and returns; commands are delivered once it has.
stopPlugin = (await mod.default(nx)) ?? null;
listen();
