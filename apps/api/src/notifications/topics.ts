import { getPool } from "../db.js";

/**
 * Nexternel's own kinds of message, each switched on or off for the bell in Settings → Notifications
 * (extensions have their own choice each). Every kind is on until switched off.
 */
export const BELL_TOPICS = ["readings", "devices", "mqtt", "disk", "backup", "updates"] as const;
export type BellTopic = (typeof BELL_TOPICS)[number];
export type BellTopics = Record<BellTopic, boolean>;

let cache: BellTopics | null = null;

export function normalizeBellTopics(raw: unknown): BellTopics {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(BELL_TOPICS.map((t) => [t, o[t] !== false])) as BellTopics;
}

/** After a restore wrote the table directly. */
export function forgetBellTopics(): void {
  cache = null;
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
