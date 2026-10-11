import {
  OPERATOR_HIDDEN_SYSTEM_IDS,
  SYSTEM_CATALOG,
  getSystemCatalogEntry,
  isSystemId,
  type SystemId,
} from "@nexternel/domain";
import { getPool } from "../db.js";

function parseAreaIds(raw: string | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseAreaIdsQuery(query: Record<string, unknown>): string[] {
  const areaIds = query.areaIds;
  if (typeof areaIds === "string") return parseAreaIds(areaIds);
  if (Array.isArray(areaIds)) {
    return areaIds.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  return [];
}

/** Distinct system_id values on enabled capabilities, optionally filtered by Area. */
export async function listSystemIdsInScope(areaIds: string[]): Promise<SystemId[]> {
  const pool = getPool();
  const params: unknown[] = [];
  let areaClause = "";
  if (areaIds.length > 0) {
    params.push(areaIds);
    areaClause = ` AND c.area_id = ANY($${params.length}::uuid[])`;
  }

  const result = await pool.query<{ system_id: string }>(
    `SELECT DISTINCT c.system_id
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     WHERE c.is_enabled = TRUE
       AND COALESCE(d.is_enabled, TRUE) = TRUE
       AND c.system_id IS NOT NULL
       ${areaClause}
     ORDER BY c.system_id ASC`,
    params
  );

  const ids: SystemId[] = [];
  for (const row of result.rows) {
    if (!isSystemId(row.system_id)) continue;
    if (OPERATOR_HIDDEN_SYSTEM_IDS.has(row.system_id)) continue;
    ids.push(row.system_id);
  }
  return ids;
}

export function catalogRowsForSystemIds(ids: SystemId[]) {
  return ids
    .map((id) => getSystemCatalogEntry(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      id: s.id,
      label: s.label,
      tier: s.tier,
      sortOrder: s.sortOrder,
    }));
}

/** Full catalogue — installer/API only; not for operator dropdowns. */
export function listAllCatalogSystems() {
  return SYSTEM_CATALOG.map((s) => ({
    id: s.id,
    label: s.label,
    tier: s.tier,
    sortOrder: s.sortOrder,
    operatorVisible: !OPERATOR_HIDDEN_SYSTEM_IDS.has(s.id),
  }));
}
