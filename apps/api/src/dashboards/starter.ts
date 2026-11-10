/**
 * The dashboard a fresh installation starts with: panels that show something real before any device
 * exists — clock, calendar, and the weather when the owner chose a town in setup. Nothing that could
 * only say "none yet" (devices, areas): their own pages say that.
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

export type StarterOptions = {
  /** The town chosen in setup (null = skipped: no weather panel). */
  place?: { name: string; latitude: number; longitude: number } | null;
};

export function starterDashboardDocument(name = "Home", opts: StarterOptions = {}) {
  const doc = emptyDashboardDocument(name);
  doc.tabIcon = "home";
  const section = doc.sections[0]!;
  const place = opts.place ?? null;
  (section as { panels: unknown[] }).panels = [
    panel("panel.clock", 0, 0, 4, 2, { clockFace: "digital", clockColor: "accent", clockBold: true }),
    panel("panel.calendar", 4, 0, 4, 2),
    ...(place
      ? [panel("panel.weather", 8, 0, 4, 2, { weatherLocation: place.name, weatherLat: place.latitude, weatherLon: place.longitude })]
      : []),
  ];
  return doc;
}

/** Create the starter dashboard when the installation has none (fresh install, not a restore). */
export async function ensureStarterDashboard(ownerUserId: string, opts: StarterOptions = {}): Promise<boolean> {
  const existing = await getPool().query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM v3_dashboards`);
  if (Number(existing.rows[0]?.c ?? 0) > 0) return false;
  await createDashboard({ name: "Home", ownerUserId, document: starterDashboardDocument("Home", opts) });
  return true;
}
