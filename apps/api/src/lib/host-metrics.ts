import { readFile } from "fs/promises";
import os from "os";

type CpuSample = { idle: number; total: number; at: number };

let lastCpu: CpuSample | null = null;

function readCpuSample(): CpuSample {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const c of cpus) {
    const t = c.times;
    const any = t as Record<string, number>;
    idle += t.idle;
    total +=
      t.user +
      t.nice +
      t.sys +
      t.idle +
      t.irq +
      (typeof any.steal === "number" ? any.steal : 0) +
      (typeof any.softirq === "number" ? any.softirq : 0);
  }
  return { idle, total, at: Date.now() };
}

/**
 * Instantaneous-ish CPU % from two samples (not 1‑minute loadavg, which looks stale).
 * First call after process start may fall back to loadavg briefly.
 */
export function sampleCpuLoadPercent(): number {
  const cpus = os.cpus();
  const cpuCount = Math.max(1, cpus.length);
  const now = readCpuSample();
  const prev = lastCpu;
  lastCpu = now;

  if (prev && now.total > prev.total && now.at - prev.at >= 200) {
    const idleDelta = now.idle - prev.idle;
    const totalDelta = now.total - prev.total;
    if (totalDelta > 0) {
      const busy = 1 - idleDelta / totalDelta;
      return Math.min(100, Math.max(0, Math.round(busy * 100)));
    }
  }

  // Fallback: 1‑minute load average until we have two samples
  const load = os.loadavg()[0] ?? 0;
  return Math.min(100, Math.max(0, Math.round((load / cpuCount) * 100)));
}

export type MemoryStats = {
  totalMb: number;
  usedMb: number;
  freeMb: number;
  percent: number;
};

/** Prefer MemAvailable (Linux) so RAM % matches what users expect on the host. */
export async function readMemoryStats(): Promise<MemoryStats> {
  try {
    const raw = await readFile("/proc/meminfo", "utf8");
    const map = new Map<string, number>();
    for (const line of raw.split("\n")) {
      const m = /^(\w+):\s+(\d+)/.exec(line);
      if (m) map.set(m[1]!, Number(m[2]));
    }
    const totalKb = map.get("MemTotal");
    const availableKb = map.get("MemAvailable");
    if (totalKb && availableKb != null && totalKb > 0) {
      const usedKb = Math.max(0, totalKb - availableKb);
      const totalMb = Math.round(totalKb / 1024);
      const usedMb = Math.round(usedKb / 1024);
      const freeMb = Math.round(availableKb / 1024);
      return {
        totalMb,
        usedMb,
        freeMb,
        percent: Math.min(100, Math.round((usedKb / totalKb) * 100)),
      };
    }
  } catch {
    /* fall through */
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  return {
    totalMb: Math.round(totalMem / 1024 / 1024),
    usedMb: Math.round(usedMem / 1024 / 1024),
    freeMb: Math.round(freeMem / 1024 / 1024),
    percent:
      totalMem > 0 ? Math.min(100, Math.round((usedMem / totalMem) * 100)) : 0,
  };
}

/** Linux host uptime from /proc/uptime (seconds), or null outside Linux. */
export async function readHostUptimeSeconds(): Promise<number | null> {
  try {
    const raw = await readFile("/proc/uptime", "utf8");
    const sec = Number.parseFloat(raw.split(/\s+/)[0] ?? "");
    if (!Number.isFinite(sec) || sec < 0) return null;
    return Math.floor(sec);
  } catch {
    return null;
  }
}
