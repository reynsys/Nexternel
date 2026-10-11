import { config } from "../config.js";

function go2rtcBase(): string {
  return config.go2rtcUrl().replace(/\/$/, "");
}

/** Prefer TCP + video-only — many NVRs drop concurrent UDP / backchannel sessions. */
export function withRtspTransportTcp(rtspUrl: string): string {
  const raw = rtspUrl.trim();
  if (!raw) return raw;
  let out = raw;
  if (!/#.*rtsp_transport=/i.test(out)) {
    out = `${out}#rtsp_transport=tcp`;
  }
  if (!/#.*media=/i.test(out)) {
    out = `${out}#media=video`;
  }
  return out;
}

/** YAML double-quoted string (safe for passwords with # : @ etc.). */
function yamlDoubleQuoted(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function streamExists(streamId: string): Promise<boolean> {
  try {
    const res = await fetch(`${go2rtcBase()}/api/streams`);
    if (!res.ok) return false;
    const data = (await res.json()) as Record<string, unknown>;
    return Boolean(data && typeof data === "object" && streamId in data);
  } catch {
    return false;
  }
}

/** True when go2rtc has an active producer with at least one video track. */
export async function go2rtcStreamHasProducer(
  streamId: string
): Promise<boolean> {
  try {
    const res = await fetch(`${go2rtcBase()}/api/streams`);
    if (!res.ok) return false;
    const data = (await res.json()) as Record<
      string,
      { producers?: Array<{ medias?: string[] }> }
    >;
    const entry = data?.[streamId];
    const producers = entry?.producers;
    if (!Array.isArray(producers) || producers.length === 0) return false;
    return producers.some((p) =>
      (p.medias ?? []).some((m) => /video/i.test(String(m)))
    );
  } catch {
    return false;
  }
}

/**
 * Fallback when PUT's surgical YAML patch fails (e.g. empty `streams: {}`).
 * PATCH /api/config with a quoted RTSP URL.
 */
async function go2rtcPatchConfigStream(
  streamId: string,
  rtspUrl: string
): Promise<void> {
  const body = `streams:\n  ${streamId}: ${yamlDoubleQuoted(rtspUrl)}\n`;
  const res = await fetch(`${go2rtcBase()}/api/config`, {
    method: "PATCH",
    headers: { "Content-Type": "text/plain" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `go2rtc patch config failed (${res.status}): ${text || res.statusText}`
    );
  }
}

/**
 * Register or update a stream in go2rtc.
 * Primary: PUT /api/streams?name=…&src=…
 * Fallback: PATCH /api/config if YAML patch fails; accept if stream is live.
 */
export async function go2rtcPutStream(
  streamId: string,
  rtspUrl: string
): Promise<void> {
  const src = withRtspTransportTcp(rtspUrl);
  const url = `${go2rtcBase()}/api/streams?name=${encodeURIComponent(streamId)}&src=${encodeURIComponent(src)}`;
  const res = await fetch(url, { method: "PUT" });
  if (res.ok) return;

  const body = await res.text().catch(() => "");

  // PUT may create the in-memory stream then fail while writing YAML.
  if (res.status === 400 && /yaml/i.test(body)) {
    try {
      await go2rtcPatchConfigStream(streamId, src);
      const retry = await fetch(url, { method: "PUT" });
      if (retry.ok || (await streamExists(streamId))) return;
    } catch {
      if (await streamExists(streamId)) return;
    }
  }

  if (await streamExists(streamId)) return;

  throw new Error(
    `go2rtc put stream failed (${res.status}): ${body || res.statusText}`
  );
}

export async function go2rtcDeleteStream(streamId: string): Promise<void> {
  stopKeepalive(streamId);
  const url = `${go2rtcBase()}/api/streams?src=${encodeURIComponent(streamId)}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    if (res.status === 400 && /yaml/i.test(body)) {
      if (!(await streamExists(streamId))) return;
    }
    throw new Error(
      `go2rtc delete stream failed (${res.status}): ${body || res.statusText}`
    );
  }
}

export function playUrlsForStream(streamId: string): {
  streamId: string;
  hlsUrl: string;
  mseUrl: string;
} {
  const explicit = config.go2rtcPublicUrl();
  const base = explicit || "/go2rtc";
  const q = `src=${encodeURIComponent(streamId)}`;
  return {
    streamId,
    // fMP4 HLS is more reliable than TS for H.264 from NVRs
    hlsUrl: `${base}/api/stream.m3u8?${q}&mp4`,
    mseUrl: `${base}/api/stream.mp4?${q}`,
  };
}

/** Serialize warmups / play opens so two dashboard tiles don't hit the NVR at once. */
let warmupTail: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type Keepalive = {
  abort: AbortController;
  idleTimer: ReturnType<typeof setTimeout>;
};

/** Hold an open MSE consumer so go2rtc keeps the RTSP producer alive for the browser. */
const keepalives = new Map<string, Keepalive>();

const KEEPALIVE_IDLE_MS = 90_000;

function stopKeepalive(streamId: string): void {
  const existing = keepalives.get(streamId);
  if (!existing) return;
  clearTimeout(existing.idleTimer);
  existing.abort.abort();
  keepalives.delete(streamId);
}

function bumpKeepaliveIdle(streamId: string): void {
  const existing = keepalives.get(streamId);
  if (!existing) return;
  clearTimeout(existing.idleTimer);
  existing.idleTimer = setTimeout(() => {
    stopKeepalive(streamId);
  }, KEEPALIVE_IDLE_MS);
}

/**
 * Open (or refresh) a long-lived `/api/stream.mp4` consumer so the NVR RTSP
 * session stays up while dashboard tiles attach. Without this, warmup exits
 * immediately and every browser tile cold-starts RTSP at once → blank tiles.
 */
function ensureKeepalive(streamId: string): void {
  const existing = keepalives.get(streamId);
  if (existing) {
    bumpKeepaliveIdle(streamId);
    return;
  }

  const abort = new AbortController();
  const idleTimer = setTimeout(() => {
    stopKeepalive(streamId);
  }, KEEPALIVE_IDLE_MS);
  keepalives.set(streamId, { abort, idleTimer });

  const url = `${go2rtcBase()}/api/stream.mp4?src=${encodeURIComponent(streamId)}`;

  void (async () => {
    while (!abort.signal.aborted) {
      try {
        const res = await fetch(url, { signal: abort.signal });
        if (!res.ok || !res.body) {
          await sleep(1500);
          continue;
        }
        const reader = res.body.getReader();
        // Drain slowly — we only need the consumer to stay connected.
        for (;;) {
          const { done } = await reader.read();
          if (done || abort.signal.aborted) break;
        }
      } catch {
        if (abort.signal.aborted) break;
        await sleep(2000);
      }
    }
  })();
}

/**
 * Ask go2rtc (from the API container) to open the RTSP producer before the
 * browser connects. Queued so multi-camera dashboards start one-at-a-time.
 * Leaves a keepalive consumer so the producer does not die before the tile plays.
 */
export function go2rtcWarmupStream(streamId: string): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    // Snapshot forces a producer even when HLS playlist is still empty.
    const frameUrl = `${go2rtcBase()}/api/frame.jpeg?src=${encodeURIComponent(streamId)}`;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25_000);
        const res = await fetch(frameUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          await res.arrayBuffer().catch(() => undefined);
          ensureKeepalive(streamId);
          // Give the NVR a beat before the next camera in the queue.
          await sleep(1200);
          const ready = await go2rtcStreamHasProducer(streamId);
          return ready || true;
        }
      } catch {
        /* retry */
      }
      await sleep(1000 + attempt * 800);
    }

    // Last resort: playlist probe + keepalive anyway
    try {
      const url = `${go2rtcBase()}/api/stream.m3u8?src=${encodeURIComponent(streamId)}&mp4`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        await res.arrayBuffer().catch(() => undefined);
        ensureKeepalive(streamId);
        await sleep(1200);
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  };

  const next = warmupTail.then(run, run);
  warmupTail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}
