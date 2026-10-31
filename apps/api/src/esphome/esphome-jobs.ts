import { spawn } from "child_process";

/**
 * Building and sending a board's software through ESPHome's own job list — the way the ESPHome page
 * and Home Assistant do it — instead of running ESPHome beside it. ESPHome then keeps its own record
 * of each board up to date (what was built, what the board runs), so "needs an update" is right
 * straight after an update, and every line ESPHome writes comes back for the update's details.
 *
 * ESPHome's job entrance is a WebSocket on its private socket; a tiny client inside the ESPHome
 * container (its own Python, which has aiohttp) talks to it and prints the lines.
 */

const ESPHOME_CONTAINER = process.env.ESPHOME_CONTAINER_NAME || "nexternel-esphome";

const JOB_CLIENT = `
import asyncio, json, sys, aiohttp
async def main():
    kind, conf, port = sys.argv[1], sys.argv[2], sys.argv[3]
    conn = aiohttp.UnixConnector(path="/run/esphome/dashboard.sock")
    async with aiohttp.ClientSession(connector=conn) as s:
        async with s.ws_connect("http://localhost/" + kind, heartbeat=30) as ws:
            await ws.send_json({"type": "spawn", "configuration": conf, "port": port})
            async for msg in ws:
                if msg.type != aiohttp.WSMsgType.TEXT:
                    break
                d = json.loads(msg.data)
                if d.get("event") == "line":
                    sys.stdout.write(d.get("data", ""))
                    sys.stdout.flush()
                elif d.get("event") == "exit":
                    code = d.get("code")
                    return 1 if code is None else int(code)
    print("ESPHome closed the connection before the job finished.")
    return 1
sys.exit(asyncio.run(main()))
`;

/** ESPHome's colour codes, sent both as real escape characters and written out ("\\033[32m"). */
export function stripColours(text: string): string {
  return text.replace(/(?:\x1b|\\033|\\x1b|\\u001b)\[[0-9;]*m/g, "");
}

/** A progress line ("Downloading packages: [====    ] 40%"); what comes before the bar names it. */
const PROGRESS = /^(.*?)(?:\[[=#>\s-]*\]\s*)?\d{1,3}%(?:\s+\d{1,3}%)*\s*$/;

/**
 * ESPHome's output made readable: colour codes removed, and each run of progress lines for the same
 * thing (download bars, "0% 10% 20%…") shortened to its last line.
 */
export function tidyJobLog(text: string): string {
  const out: string[] = [];
  let lastKey: string | null = null;
  for (const line of stripColours(text).split(/\r?\n|\r/)) {
    const m = PROGRESS.exec(line);
    const key = m ? m[1]!.trim() : null;
    if (key !== null && key === lastKey) out[out.length - 1] = line;
    else out.push(line);
    lastKey = key;
  }
  return out.join("\n");
}

export type JobResult = { ok: boolean; log: string };

/**
 * Run one ESPHome job and wait for it: "compile" builds the board's software, "upload" sends the
 * last build to `port` (the board's address, or "OTA"). `configuration` is the settings file name.
 */
export function runEsphomeJob(
  kind: "compile" | "upload",
  configuration: string,
  port = "",
  timeoutMs = 1_200_000
): Promise<JobResult> {
  return new Promise((resolve) => {
    const child = spawn("docker", ["exec", "-i", ESPHOME_CONTAINER, "python3", "-", kind, configuration, port]);
    let out = "";
    const timer = setTimeout(() => {
      out += `\nNexternel stopped waiting after ${Math.round(timeoutMs / 60_000)} minutes.`;
      child.kill();
    }, timeoutMs);
    child.stdout.on("data", (b: Buffer) => (out += b.toString()));
    child.stderr.on("data", (b: Buffer) => (out += b.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, log: `Could not reach ESPHome: ${err.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, log: tidyJobLog(out).trim() });
    });
    child.stdin.end(JOB_CLIENT);
  });
}
