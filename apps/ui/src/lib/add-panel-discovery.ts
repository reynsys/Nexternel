import type { PanelCategoryId } from "@nexternel/plugin-sdk";
import { PANEL_GAUGE_TYPE } from "@nexternel/domain";

import { bootstrapV5PanelRegistry, listPanelRegistrations } from "../panels/registry";

/** Supported Dashboard Add Panel types — registry internals stay hidden. */
export const DASHBOARD_ADD_PANEL_TYPES: ReadonlySet<string> = new Set([
  "panel.controls",
  "panel.status",
  PANEL_GAUGE_TYPE,
  "panel.charts",
  "panel.camera",
  "panel.clock",
  "panel.weather",
  "panel.calendar",
  "panel.system",
  "panel.rooms",
]);



/** User-facing discovery sections — presentation intent, not domain hierarchy. */

export const ADD_PANEL_DISCOVERY_SECTIONS: {

  id: PanelCategoryId;

  label: string;

  order: number;

}[] = [

  { id: "controls", label: "Controls", order: 0 },

  { id: "status", label: "Status", order: 1 },

  { id: "history", label: "Charts", order: 2 },

  { id: "sensors", label: "Gauges", order: 3 },

  { id: "media", label: "Cameras", order: 4 },

  { id: "system", label: "Generic", order: 5 },

  { id: "plugins", label: "More", order: 6 },

];



export type AddPanelDiscoveryItem = {

  id: string;

  label: string;

  description: string;

  section: PanelCategoryId;

  sortOrder: number;

};



/** Short lines for the Add Panel list. The group name is not repeated on the item. */
const ADD_PANEL_COPY: Record<string, { label?: string; description: string }> = {
  "panel.controls": { description: "Switches you can turn on and off." },
  "panel.status": { description: "Live readings, such as temperature or humidity." },
  "panel.charts": { description: "How a reading changes over time." },
  "panel.camera": { description: "Live pictures from your cameras." },
  [PANEL_GAUGE_TYPE]: { description: "A dial for one sensor." },
  "panel.clock": { description: "The time and today’s date." },
  "panel.weather": { description: "Today’s weather and the next few days." },
  "panel.calendar": { description: "The days of this month." },
  "panel.system": {
    label: "System information",
    description: "How this home’s server is doing.",
  },
  "panel.rooms": { description: "Every room as a button — a Dashboard Menu inside your dashboard." },
};

function sectionLabel(section: PanelCategoryId): string {

  return ADD_PANEL_DISCOVERY_SECTIONS.find((s) => s.id === section)?.label ?? "Panels";

}



/** Load Add Panel choices from the V5 logical Panel registry (single source). */

export function loadAddPanelDiscoveryCatalog(): AddPanelDiscoveryItem[] {

  bootstrapV5PanelRegistry();

  const seen = new Set<string>();

  const items: AddPanelDiscoveryItem[] = [];

  for (const entry of listPanelRegistrations()) {

    const d = entry.descriptor;

    if (!d.userSelectable || d.previewOnly) continue;
    if (!DASHBOARD_ADD_PANEL_TYPES.has(d.type) && d.source !== "plugin") continue;

    if (seen.has(d.type)) continue;

    seen.add(d.type);

    const copy = ADD_PANEL_COPY[d.type];

    items.push({

      id: d.type,

      label: copy?.label ?? d.label,

      description: copy?.description || d.description || "",

      section: d.category ?? "plugins",

      sortOrder: d.sortOrder ?? 9999,

    });

  }

  return items.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

}



export function filterAddPanelDiscovery(

  catalog: AddPanelDiscoveryItem[],

  query: string

): AddPanelDiscoveryItem[] {

  const q = query.trim().toLowerCase();

  if (!q) return catalog;

  return catalog.filter(

    (item) =>

      item.label.toLowerCase().includes(q) ||

      item.description.toLowerCase().includes(q) ||

      sectionLabel(item.section).toLowerCase().includes(q)

  );

}



export function groupAddPanelDiscovery(

  catalog: AddPanelDiscoveryItem[]

): { section: PanelCategoryId; label: string; items: AddPanelDiscoveryItem[] }[] {

  const groups = new Map<PanelCategoryId, AddPanelDiscoveryItem[]>();

  for (const item of catalog) {

    const list = groups.get(item.section) ?? [];

    list.push(item);

    groups.set(item.section, list);

  }

  return ADD_PANEL_DISCOVERY_SECTIONS

    .filter((s) => (groups.get(s.id)?.length ?? 0) > 0)

    .map((s) => ({

      section: s.id,

      label: s.label,

      items: groups.get(s.id) ?? [],

    }));

}



export function findAddPanelDiscoveryItem(

  catalog: AddPanelDiscoveryItem[],

  typeId: string

): AddPanelDiscoveryItem | undefined {

  return catalog.find((item) => item.id === typeId);

}


