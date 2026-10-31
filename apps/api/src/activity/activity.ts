import { getPool } from "../db.js";
import { publishChange } from "../live/changes.js";

/**
 * The Activity log: what happened in Nexternel, newest first, kept 30 days — like the log screen of
 * the earlier Nexternel. It brings together what is already recorded (a device going offline and
 * coming back, restarts: device_connection_events; board updates: board_update_log) and what is
 * written here: switches turning on or off (and who or what did it), dashboards made, saved or
 * deleted, and Nexternel's own events (started, the message service lost and back, backups).
 */

export type ActivityKind = "device" | "switch" | "update" | "dashboard" | "system";

export async function ensureActivitySchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id         BIGSERIAL PRIMARY KEY,
      at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      kind       VARCHAR(24) NOT NULL,
      device_id  UUID REFERENCES devices(id) ON DELETE SET NULL,
      text       TEXT NOT NULL,
      who        VARCHAR(100)
    );
    CREATE INDEX IF NOT EXISTS idx_activity_log_at ON activity_log (at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_log_device ON activity_log (device_id, at DESC);
  `);
}

/** Write one entry (never fails the caller). */
export async function logActivity(entry: { kind: ActivityKind; text: string; deviceId?: string | null; who?: string | null }): Promise<void> {
  try {
    await getPool().query(`INSERT INTO activity_log (kind, device_id, text, who) VALUES ($1, $2, $3, $4)`, [
      entry.kind,
      entry.deviceId ?? null,
      entry.text.slice(0, 1000),
      entry.who ?? null,
    ]);
    publishChange("activity");
  } catch {
    /* the log is never a reason for something else to fail */
  }
}

/** Switch commands sent from Nexternel, so the board's answer can say who switched it. */
const commands = new Map<string, { who: string; value: boolean; at: number }>();

export function noteSwitchCommand(capabilityId: string, value: boolean, who: string): void {
  commands.set(capabilityId, { who, value, at: Date.now() });
}

/** A switch's state changed (a live message from the board, not a kept one). */
export async function logSwitchChange(capabilityId: string, value: boolean): Promise<void> {
  const cmd = commands.get(capabilityId);
  const fromNexternel = cmd && cmd.value === value && Date.now() - cmd.at < 20_000;
  if (cmd && fromNexternel) commands.delete(capabilityId);
  try {
    const r = await getPool().query<{ device_id: string; device: string; name: string }>(
      `SELECT c.device_id, d.name AS device, COALESCE(NULLIF(c.custom_name, ''), c.name) AS name
         FROM capabilities c JOIN devices d ON d.id = c.device_id WHERE c.id = $1`,
      [capabilityId]
    );
    const row = r.rows[0];
    if (!row) return;
    await logActivity({
      kind: "switch",
      deviceId: row.device_id,
      text: `${row.device} · ${row.name} turned ${value ? "on" : "off"}${fromNexternel ? "" : " (at the switch, or by the board itself)"}`,
      who: fromNexternel ? cmd!.who : null,
    });
  } catch {
    /* see logActivity */
  }
}

export type ActivityEntry = { at: string; kind: ActivityKind; deviceId: string | null; device: string | null; text: string; who: string | null };

/** Newest first; `before` (an ISO time) pages back; filter by kind or device. */
export async function listActivity(opts: { kind?: ActivityKind; deviceId?: string; before?: string; limit?: number }): Promise<ActivityEntry[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const r = await getPool().query<ActivityEntry>(
    `SELECT * FROM (
       SELECT a.at, a.kind, a.device_id AS "deviceId", d.name AS device, a.text, a.who
         FROM activity_log a LEFT JOIN devices d ON d.id = a.device_id
       UNION ALL
       SELECT e.at, 'device', e.device_id, d.name,
              d.name || CASE e.state WHEN 'online' THEN ' is back online' WHEN 'offline' THEN ' went offline' ELSE ' restarted' END,
              NULL
         FROM device_connection_events e JOIN devices d ON d.id = e.device_id
       UNION ALL
       SELECT u.finished_at, 'update', u.device_id, d.name, d.name || ': ' || u.message, NULL
         FROM board_update_log u JOIN devices d ON d.id = u.device_id
     ) x
     WHERE ($1::text IS NULL OR x.kind = $1)
       AND ($2::uuid IS NULL OR x."deviceId" = $2)
       AND ($3::timestamptz IS NULL OR x.at < $3)
       AND x.at > NOW() - INTERVAL '30 days'
     ORDER BY x.at DESC
     LIMIT $4`,
    [opts.kind ?? null, opts.deviceId ?? null, opts.before ?? null, limit]
  );
  return r.rows.map((e) => ({ ...e, at: new Date(e.at).toISOString() }));
}

/** Keep 30 days. */
export async function pruneActivity(): Promise<void> {
  await getPool().query(`DELETE FROM activity_log WHERE at < NOW() - INTERVAL '30 days'`);
}
