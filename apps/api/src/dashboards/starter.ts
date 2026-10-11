/**
 * The dashboard a fresh installation starts with — panels that work before any device exists:
 * clock, calendar, the device list (fills in as devices are added) and server information.
 */
import { emptyDashboardDocument } from "@nexternel/domain";
import { getPool } from "../db.js";
import { createDashboard } from "./store.js";

const emptyScope = {
  areaIds: [],
  groupIds: [],
  cameraIds: [],
  systemIds: [],
  contentMode: "auto",
  capabilityIds: [],
  inheritSectionArea: false,
};

function panel(type: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}) {
  const id = `starter-${type.replace("panel.", "")}`;
  return {
    id,
    type,
    layout: { i: id, x, y, w, h },
    bindings: {},
    config: { appearance: { layout: "card" }, panelScope: emptyScope, configSchemaVersion: 1, ...extra },
  };
}

export function starterDashboardDocument(name = "Home") {
  const doc = emptyDashboardDocument(name);
  doc.tabIcon = "home";
  const section = doc.sections[0]!;
  (section as { panels: unknown[] }).panels = [
    panel("panel.clock", 0, 0, 4, 2, { clockFace: "digital", clockColor: "accent", clockBold: true }),
    panel("panel.calendar", 4, 0, 4, 2),
    panel("panel.system", 8, 0, 4, 2),
    panel("panel.devices", 0, 2, 4, 2),
  ];
  return doc;
}

/** Create the starter dashboard when the installation has none (fresh install, not a restore). */
export async function ensureStarterDashboard(ownerUserId: string): Promise<boolean> {
  const existing = await getPool().query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM v3_dashboards`);
  if (Number(existing.rows[0]?.c ?? 0) > 0) return false;
  await createDashboard({ name: "Home", ownerUserId, document: starterDashboardDocument("Home") });
  return true;
}
