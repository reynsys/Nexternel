import { readdir, readFile } from "fs/promises";
import { join } from "path";

const THERMAL_ROOT = "/sys/class/thermal";

/** Highest Linux thermal-zone temp (°C), or null if unavailable. */
export async function readServerTemperatureC(): Promise<number | null> {
  try {
    const entries = await readdir(THERMAL_ROOT);
    const temps: number[] = [];

    for (const entry of entries) {
      if (!entry.startsWith("thermal_zone")) continue;
      try {
        const raw = await readFile(join(THERMAL_ROOT, entry, "temp"), "utf8");
        const milli = parseInt(raw.trim(), 10);
        if (!Number.isNaN(milli) && milli > 0) {
          temps.push(milli / 1000);
        }
      } catch {
        /* zone unreadable */
      }
    }

    if (temps.length === 0) return null;
    return Math.round(Math.max(...temps) * 10) / 10;
  } catch {
    return null;
  }
}
