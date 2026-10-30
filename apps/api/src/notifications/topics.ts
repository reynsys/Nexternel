import { getPool } from "../db.js";

/**
 * Nexternel's own kinds of message, each switched on or off for the bell in Settings → Notifications
 * (extensions have their own choice each). Every kind is on until switched off.
 */
export const BELL_TOPICS = ["readings", "devices", "mqtt", "disk", "backup", "updates"] as const;
export type BellTopic = (typeof BELL_TOPICS)[number];
export type BellTopics = Record<BellTopic, boolean>;

/** A device is reported only after it has been offline this long (minutes); shorter drops stay in its history. */
export const OFFLINE_MINUTE_CHOICES = [1, 5, 15, 30, 60] as const;
export const DEFAULT_OFFLINE_MINUTES = 5;
export function normalizeOfflineMinutes(raw: unknown): number {
  const n = Number(raw);
  return (OFFLINE_MINUTE_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_OFFLINE_MINUTES;
}

let cache: BellTopics | null = null;
let offlineMinutesCache: number | null = null;

export function normalizeBellTopics(raw: unknown): BellTopics {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(BELL_TOPICS.map((t) => [t, o[t] !== false])) as BellTopics;
}

/** After a restore wrote the table directly. */
export function forgetBellTopics(): void {
  cache = null;
  offlineMinutesCache = null;
}

/** How long a device must be offline before the bell hears of it. */
export async function getOfflineMinutes(): Promise<number> {
  if (offlineMinutesCache !== null) return offlineMinutesCache;
  const r = await getPool()
    .query<{ minutes: number | null }>(`SELECT minutes FROM notification_topics WHERE topic = 'devices'`)
    .catch(() => ({ rows: [] as { minutes: number | null }[] }));
  offlineMinutesCache = normalizeOfflineMinutes(r.rows[0]?.minutes);
  return offlineMinutesCache;
}

export async function setOfflineMinutes(raw: unknown): Promise<number> {
  const minutes = normalizeOfflineMinutes(raw);
  const on = (await getBellTopics()).devices;
  await getPool().query(
    `INSERT INTO notification_topics (topic, enabled, minutes) VALUES ('devices', $1, $2) ON CONFLICT (topic) DO UPDATE SET minutes = EXCLUDED.minutes`,
    [on, minutes]
  );
  offlineMinutesCache = minutes;
  return minutes;
}

export async function getBellTopics(): Promise<BellTopics> {
  if (cache) return cache;
  const r = await getPool().query<{ topic: string; enabled: boolean }>(`SELECT topic, enabled FROM notification_topics`);
  cache = normalizeBellTopics(Object.fromEntries(r.rows.map((row) => [row.topic, row.enabled])));
  return cache;
}

/** True when messages of this kind reach the bell. */
export async function bellTopicOn(topic: BellTopic): Promise<boolean> {
  return (await getBellTopics().catch(() => normalizeBellTopics(null)))[topic];
}

export async function setBellTopics(next: Partial<Record<string, unknown>>): Promise<BellTopics> {
  const merged = normalizeBellTopics({ ...(await getBellTopics()), ...next });
  const pool = getPool();
  for (const t of BELL_TOPICS) {
    await pool.query(
      `INSERT INTO notification_topics (topic, enabled) VALUES ($1, $2) ON CONFLICT (topic) DO UPDATE SET enabled = EXCLUDED.enabled`,
      [t, merged[t]]
    );
  }
  cache = merged;
  return merged;
}
