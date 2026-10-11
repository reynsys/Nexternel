/**
 * Remap dashboard widget capabilityId values after Adopt/sync.
 * Old capability UUIDs in dashboard JSON no longer exist; new ones were created
 * for the same relays/sensors (source_id). Match by title / unique name / sourceId.
 */

import { getPool } from "../db.js";

type CapRow = {
  id: string;
  name: string;
  kind: string;
  device_name: string;
  source_id: string;
  source_type: string;
};

function walkReplaceCapabilityIds(
  node: unknown,
  resolve: (oldId: string, ctx: { title?: string }) => string | null,
  bySource: Map<string, CapRow>,
  ctx: { title?: string } = {}
): { node: unknown; changed: number } {
  let changed = 0;
  if (Array.isArray(node)) {
    const out = [];
    for (const item of node) {
      const r = walkReplaceCapabilityIds(item, resolve, bySource, ctx);
      out.push(r.node);
      changed += r.changed;
    }
    return { node: out, changed };
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    const title =
      typeof obj.title === "string" ? obj.title : ctx.title;

    if (typeof obj.capabilityId === "string" && obj.capabilityId.trim()) {
      let mapped: string | null = null;
      const sourceId =
        typeof obj.sourceId === "string" ? obj.sourceId.trim() : "";
      const sourceType =
        typeof obj.sourceType === "string" ? obj.sourceType.trim() : "";
      if (sourceId && sourceType) {
        const hit = bySource.get(`${sourceType}:${sourceId}`);
        if (hit) mapped = hit.id;
      }
      if (!mapped) mapped = resolve(obj.capabilityId, { title });

      for (const [k, v] of Object.entries(obj)) {
        if (k === "capabilityId") {
          if (mapped && mapped !== v) {
            next[k] = mapped;
            changed += 1;
          } else {
            next[k] = v;
          }
          continue;
        }
        if (k === "title") {
          next[k] = v;
          continue;
        }
        const r = walkReplaceCapabilityIds(v, resolve, bySource, { title });
        next[k] = r.node;
        changed += r.changed;
      }
      return { node: next, changed };
    }

    for (const [k, v] of Object.entries(obj)) {
      const r = walkReplaceCapabilityIds(v, resolve, bySource, { title });
      next[k] = r.node;
      changed += r.changed;
    }
    return { node: next, changed };
  }
  return { node, changed };
}

function enrichSourceIds(
  node: unknown,
  byId: Map<string, CapRow>
): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => enrichSourceIds(item, byId));
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      next[k] = enrichSourceIds(v, byId);
    }
    if (typeof next.capabilityId === "string") {
      const cap = byId.get(next.capabilityId);
      if (cap) {
        next.sourceId = cap.source_id;
        next.sourceType = cap.source_type;
      }
    }
    if (next.bindings && typeof next.bindings === "object") {
      const b = next.bindings as Record<string, unknown>;
      if (typeof b.capabilityId === "string") {
        const cap = byId.get(b.capabilityId);
        if (cap) {
          b.sourceId = cap.source_id;
          b.sourceType = cap.source_type;
        }
      }
    }
    return next;
  }
  return node;
}

export async function repairDashboardCapabilityBindings(): Promise<{
  dashboardsUpdated: number;
  bindingsRemapped: number;
}> {
  const pool = getPool();
  const caps = await pool.query<CapRow>(
    `SELECT c.id, c.name, c.kind, d.name AS device_name, c.source_id, c.source_type
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     WHERE c.is_enabled = TRUE`
  );

  const byId = new Map(caps.rows.map((c) => [c.id, c]));
  const bySource = new Map(
    caps.rows.map((c) => [`${c.source_type}:${c.source_id}`, c])
  );
  const byName = new Map<string, CapRow[]>();
  const byDeviceName = new Map<string, CapRow[]>();
  for (const c of caps.rows) {
    const n = c.name.trim().toLowerCase();
    const list = byName.get(n) ?? [];
    list.push(c);
    byName.set(n, list);
    const key = `${c.device_name.trim().toLowerCase()}::${n}`;
    const dlist = byDeviceName.get(key) ?? [];
    dlist.push(c);
    byDeviceName.set(key, dlist);
  }

  const resolve = (
    oldId: string,
    ctx: { title?: string }
  ): string | null => {
    if (byId.has(oldId)) return oldId;

    const asRelay = bySource.get(`relay:${oldId}`);
    if (asRelay) return asRelay.id;
    const asSensor = bySource.get(`sensor:${oldId}`);
    if (asSensor) return asSensor.id;

    const title = ctx.title?.trim().toLowerCase();
    if (title) {
      const named = byName.get(title);
      if (named?.length === 1) return named[0]!.id;
      if (
        (title.includes("meter") || title.includes("gauge")) &&
        title.includes("energy") &&
        !title.includes("daily")
      ) {
        const power = caps.rows.filter((c) => c.kind === "power");
        if (power.length === 1) return power[0]!.id;
      }
      const parts = title.split("·").map((p) => p.trim());
      if (parts.length >= 2) {
        const entity = parts[parts.length - 1]!;
        const device = parts[parts.length - 2]!;
        const hit = byDeviceName.get(`${device}::${entity}`);
        if (hit?.length === 1) return hit[0]!.id;
        const byEnt = byName.get(entity);
        if (byEnt?.length === 1) return byEnt[0]!.id;
      }
    }
    return null;
  };

  const dashes = await pool.query<{ id: string; document: unknown }>(
    `SELECT id, document FROM v3_dashboards`
  );

  let dashboardsUpdated = 0;
  let bindingsRemapped = 0;

  for (const dash of dashes.rows) {
    const walked = walkReplaceCapabilityIds(
      dash.document,
      resolve,
      bySource
    );
    const enriched = enrichSourceIds(walked.node, byId);
    const before = JSON.stringify(dash.document);
    const after = JSON.stringify(enriched);
    if (before === after) continue;

    await pool.query(
      `UPDATE v3_dashboards SET document = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [dash.id, after]
    );
    dashboardsUpdated += 1;
    bindingsRemapped += walked.changed;
  }

  return { dashboardsUpdated, bindingsRemapped };
}
