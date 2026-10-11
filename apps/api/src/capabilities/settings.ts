/**
 * Your own name and icon for a reading (capability). Device syncs only ever write `name` — the
 * device's own name — so these survive device updates, restarts and restores.
 */
import { getPool } from "../db.js";

/** "auto" = icon chosen by the kind of reading; otherwise an icon id from the UI's icon catalog. */
const ICON_ID = /^[a-z0-9][a-z0-9-]{0,59}$/;

export function normalizeIconId(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return "auto";
  return typeof raw === "string" && ICON_ID.test(raw) ? raw : null;
}

/**
 * Readings that have never had an icon decided get one, once: for a general kind of reading a few
 * names say more ("Gas usage today" is an energy reading, but gas). Readings whose kind is already
 * specific (a temperature on a device called "Air Quality") keep their kind's icon. Everything starts
 * visible and changeable in the reading's settings.
 */
export async function assignStarterIcons(): Promise<number> {
  const result = await getPool().query(
    `UPDATE capabilities SET icon = CASE
       WHEN kind IN ('temperature', 'humidity', 'pressure', 'co2', 'pm1', 'pm25', 'pm10',
                     'battery', 'voltage', 'current', 'camera', 'motion', 'door', 'lock') THEN 'auto'
       WHEN name ~* '\\mgas\\M' THEN 'gas'
       WHEN name ~* '\\m(light|lights|lamp|bulb)\\M' THEN 'lightbulb'
       WHEN name ~* '\\m(air|fan|ventilation)\\M' THEN 'air'
       ELSE 'auto'
     END
     WHERE icon IS NULL`
  );
  return result.rowCount ?? 0;
}

/** Change a reading's own name and/or icon. A null or empty name goes back to the device's name. */
export async function updateCapabilitySettings(
  id: string,
  patch: { name?: string | null; icon?: string | null }
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  if (patch.name !== undefined) {
    const name = patch.name?.trim() ?? "";
    if (name.length > 100) throw new Error("Name is too long (100 characters at most).");
    params.push(name || null);
    // Typing the device's own name back is the same as clearing your own.
    sets.push(`custom_name = CASE WHEN $${params.length}::text IS NULL OR $${params.length} = name THEN NULL ELSE $${params.length} END`);
  }
  if (patch.icon !== undefined) {
    const icon = normalizeIconId(patch.icon);
    if (icon === null) throw new Error("Unknown icon.");
    params.push(icon);
    sets.push(`icon = $${params.length}`);
  }
  if (sets.length === 0) return true;
  const result = await getPool().query(
    `UPDATE capabilities SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING id`,
    params
  );
  return (result.rowCount ?? 0) > 0;
}

/** Rename by sensor / relay (Devices page): sets the reading's own name, not the device's. */
export async function renameCapabilityBySource(
  sourceType: "sensor" | "relay",
  sourceId: string,
  name: string
): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name cannot be empty");
  const row = await getPool().query<{ id: string }>(
    `SELECT id FROM capabilities WHERE source_type = $1 AND source_id = $2 LIMIT 1`,
    [sourceType, sourceId]
  );
  const id = row.rows[0]?.id;
  if (!id) return false;
  return updateCapabilitySettings(id, { name: trimmed });
}
