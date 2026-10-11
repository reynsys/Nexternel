import { isInternalRelayEntity } from "@nexternel/domain";
import { getPool } from "../db.js";

/** Remove relays that are ESPHome internal outputs (e.g. Glow status LED GPIO). */
export async function pruneInternalRelayRows(): Promise<number> {
  const pool = getPool();
  const relays = await pool.query<{
    id: string;
    name: string;
    esphome_entity_id: string | null;
  }>(
    `SELECT id, name, esphome_entity_id FROM relays`
  );

  const orphanIds: string[] = [];
  for (const row of relays.rows) {
    if (isInternalRelayEntity(row.name, row.esphome_entity_id)) {
      orphanIds.push(row.id);
    }
  }
  if (orphanIds.length === 0) return 0;

  await pool.query(
    `DELETE FROM capabilities
     WHERE source_type = 'relay' AND source_id = ANY($1::uuid[])`,
    [orphanIds]
  );
  const deleted = await pool.query(
    `DELETE FROM relays WHERE id = ANY($1::uuid[]) RETURNING id`,
    [orphanIds]
  );
  return deleted.rowCount ?? 0;
}
