import { getPool } from "../db.js";
import {
  emptyDashboardDocument,
  migrateDashboardDocument,
  type PersistedDashboardDocument,
} from "@nexternel/domain";

export type DashboardRow = {
  id: string;
  owner_user_id: string | null;
  name: string;
  document: PersistedDashboardDocument;
  is_default: boolean;
  tab_order: number;
  created_at: Date;
  updated_at: Date;
};

function normalizeRow(row: DashboardRow): DashboardRow {
  return {
    ...row,
    document: migrateDashboardDocument(row.document),
  };
}

export async function listDashboards(ownerUserId?: string): Promise<DashboardRow[]> {
  if (ownerUserId) {
    const result = await getPool().query<DashboardRow>(
      `SELECT id, owner_user_id, name, document, is_default, tab_order, created_at, updated_at
       FROM v3_dashboards
       WHERE visible_to_all OR owner_user_id IS NULL OR owner_user_id = $1
       ORDER BY tab_order ASC, created_at ASC`,
      [ownerUserId]
    );
    return result.rows.map(normalizeRow);
  }
  const result = await getPool().query<DashboardRow>(
    `SELECT id, owner_user_id, name, document, is_default, tab_order, created_at, updated_at
     FROM v3_dashboards
     ORDER BY tab_order ASC, created_at ASC`
  );
  return result.rows.map(normalizeRow);
}

export async function getDashboard(id: string): Promise<DashboardRow | null> {
  const result = await getPool().query<DashboardRow>(
    `SELECT id, owner_user_id, name, document, is_default, tab_order, created_at, updated_at
     FROM v3_dashboards WHERE id = $1 LIMIT 1`,
    [id]
  );
  const row = result.rows[0];
  return row ? normalizeRow(row) : null;
}

export async function createDashboard(input: {
  name: string;
  ownerUserId: string;
  document?: unknown;
}): Promise<DashboardRow> {
  const document = migrateDashboardDocument(
    input.document ?? emptyDashboardDocument(input.name)
  );
  document.name = input.name;

  const defaults = await getPool().query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM v3_dashboards WHERE is_default = TRUE`
  );
  const makeDefault = Number(defaults.rows[0]?.c ?? 0) === 0;

  const orderRow = await getPool().query<{ next: number }>(
    `SELECT COALESCE(MAX(tab_order), -1) + 1 AS next FROM v3_dashboards`
  );
  const tabOrder = orderRow.rows[0]?.next ?? 0;

  const result = await getPool().query<DashboardRow>(
    `INSERT INTO v3_dashboards (owner_user_id, name, document, is_default, tab_order)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     RETURNING id, owner_user_id, name, document, is_default, tab_order, created_at, updated_at`,
    [input.ownerUserId, input.name, JSON.stringify(document), makeDefault, tabOrder]
  );
  return normalizeRow(result.rows[0]);
}

export async function updateDashboard(
  id: string,
  input: { name?: string; document?: unknown; isDefault?: boolean }
): Promise<DashboardRow | null> {
  const existing = await getDashboard(id);
  if (!existing) return null;

  const name = input.name ?? existing.name;
  const document = migrateDashboardDocument(input.document ?? existing.document);
  document.name = name;
  const isDefault = input.isDefault ?? existing.is_default;

  if (isDefault) {
    await getPool().query(`UPDATE v3_dashboards SET is_default = FALSE WHERE is_default = TRUE`);
  }

  const result = await getPool().query<DashboardRow>(
    `UPDATE v3_dashboards
     SET name = $2, document = $3::jsonb, is_default = $4, updated_at = NOW()
     WHERE id = $1
     RETURNING id, owner_user_id, name, document, is_default, tab_order, created_at, updated_at`,
    [id, name, JSON.stringify(document), isDefault]
  );
  const row = result.rows[0];
  return row ? normalizeRow(row) : null;
}

export async function deleteDashboard(id: string): Promise<boolean> {
  const result = await getPool().query(`DELETE FROM v3_dashboards WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

/** Persist top navigation tab order (array index = tab_order). */
export async function reorderDashboards(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `UPDATE v3_dashboards SET tab_order = $2, updated_at = NOW() WHERE id = $1`,
        [orderedIds[i], i]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
