import { getPool } from "../db.js";
import { publishChange } from "../live/changes.js";

export type NotificationLevel = "info" | "warning" | "alert";

export type NotificationRecord = {
  id: string;
  source: string;
  sourceName: string;
  level: NotificationLevel;
  title: string;
  body: string;
  createdAt: string;
};

const KEEP = 500;

export function normalizeLevel(raw: unknown): NotificationLevel {
  return raw === "warning" || raw === "alert" ? raw : "info";
}

/** Which of a plugin's messages reach the bell (Settings → Extensions). */
export type PluginBell = "all" | "important" | "none";

export function normalizePluginBell(raw: unknown): PluginBell {
  return raw === "all" || raw === "none" ? raw : "important";
}

/**
 * The level a plugin's message gets in the bell, or null when it is not shown. Red ("act now") is
 * kept for Nexternel itself (status lights, problems with the system), so plugins reach amber at most.
 */
export function pluginMessageLevel(requested: unknown, bell: PluginBell): NotificationLevel | null {
  const level = normalizeLevel(requested) === "info" ? "info" : "warning";
  if (bell === "none") return null;
  if (bell === "important" && level === "info") return null;
  return level;
}

const LEVEL_RANK: Record<NotificationLevel, number> = { info: 1, warning: 2, alert: 3 };

/** Add a message to the bell. `source` is e.g. "plugin:ai" or "system". */
export async function addNotification(input: {
  source: string;
  sourceName: string;
  level: NotificationLevel;
  title: string;
  body?: string;
}): Promise<NotificationRecord> {
  const pool = getPool();
  const res = await pool.query<{ id: string; created_at: Date }>(
    `INSERT INTO notifications (source, source_name, level, title, body)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
    [input.source, input.sourceName.slice(0, 120), input.level, input.title.slice(0, 200), (input.body ?? "").slice(0, 4000)]
  );
  // Keep the list bounded.
  await pool.query(
    `DELETE FROM notifications WHERE id IN (
       SELECT id FROM notifications ORDER BY created_at DESC OFFSET $1
     )`,
    [KEEP]
  );
  const row = res.rows[0]!;
  publishChange("notifications");
  return {
    id: row.id,
    source: input.source,
    sourceName: input.sourceName,
    level: input.level,
    title: input.title,
    body: input.body ?? "",
    createdAt: row.created_at.toISOString(),
  };
}

export async function listNotifications(
  userId: string,
  limit: number
): Promise<{ items: NotificationRecord[]; unreadCount: number; unreadLevel: NotificationLevel | null; lastReadAt: string | null }> {
  const pool = getPool();
  const read = await pool.query<{ last_read_at: Date }>(
    `SELECT last_read_at FROM notification_reads WHERE user_id = $1`,
    [userId]
  );
  const lastReadAt = read.rows[0]?.last_read_at ?? null;
  const rows = await pool.query<{
    id: string; source: string; source_name: string; level: string; title: string; body: string; created_at: Date;
  }>(
    `SELECT id, source, source_name, level, title, body, created_at
     FROM notifications ORDER BY created_at DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)]
  );
  const unread = await pool.query<{ n: string; level: string }>(
    `SELECT COUNT(*)::text AS n, level FROM notifications
     WHERE created_at > COALESCE($1::timestamptz, '-infinity') GROUP BY level`,
    [lastReadAt]
  );
  let unreadCount = 0;
  let unreadLevel: NotificationLevel | null = null;
  for (const r of unread.rows) {
    unreadCount += Number(r.n);
    const level = normalizeLevel(r.level);
    if (!unreadLevel || LEVEL_RANK[level] > LEVEL_RANK[unreadLevel]) unreadLevel = level;
  }
  return {
    items: rows.rows.map((r) => ({
      id: r.id,
      source: r.source,
      sourceName: r.source_name,
      level: normalizeLevel(r.level),
      title: r.title,
      body: r.body,
      createdAt: r.created_at.toISOString(),
    })),
    unreadCount,
    /** The most important unread message's level: the bell's colour. */
    unreadLevel,
    lastReadAt: lastReadAt ? lastReadAt.toISOString() : null,
  };
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await getPool().query(
    `INSERT INTO notification_reads (user_id, last_read_at) VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET last_read_at = NOW()`,
    [userId]
  );
}

export async function clearNotifications(): Promise<void> {
  await getPool().query(`DELETE FROM notifications`);
}
