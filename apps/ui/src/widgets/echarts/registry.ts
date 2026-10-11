import type { EchartsPreset } from "./types";
import { GAUGE_PRESETS } from "./presets/gauges";
import { CHART_PRESETS } from "./presets/charts";
import {
  getEchartsFamilyMeta,
  listEchartsFamilyMeta,
  type EchartsFamilyMeta,
} from "./families";

const ALL: EchartsPreset[] = [...GAUGE_PRESETS, ...CHART_PRESETS];

const BY_ID = new Map(ALL.map((p) => [p.id, p]));

export function listEchartsPresets(): EchartsPreset[] {
  return ALL;
}

export function getEchartsPreset(id: string | undefined): EchartsPreset {
  if (id && BY_ID.has(id)) return BY_ID.get(id)!;
  return BY_ID.get("gauge")!;
}

export function listEchartsPresetsByCategory(
  category: EchartsPreset["category"]
): EchartsPreset[] {
  return ALL.filter((p) => p.category === category);
}

/** Raw family ids present in the registry (ordered by meta list). */
export function listEchartsFamilies(): string[] {
  const present = new Set(ALL.map((p) => p.family));
  return listEchartsFamilyMeta()
    .map((f) => f.id)
    .filter((id) => present.has(id));
}

export function listEchartsFamilyOptions(): EchartsFamilyMeta[] {
  const present = new Set(ALL.map((p) => p.family));
  return listEchartsFamilyMeta().filter((f) => present.has(f.id));
}

/** Families that appear for a catalog category (sensors / history / system). */
export function listEchartsFamilyOptionsForCategory(
  category: EchartsPreset["category"]
): EchartsFamilyMeta[] {
  const present = new Set(
    ALL.filter((p) => p.category === category).map((p) => p.family)
  );
  return listEchartsFamilyMeta().filter((f) => present.has(f.id));
}

export { getEchartsFamilyMeta };

/** Presets grouped for dropdowns (Family → presets). */
export function groupEchartsPresetsByFamily(
  presets: EchartsPreset[] = ALL
): { family: EchartsFamilyMeta; presets: EchartsPreset[] }[] {
  const byFamily = new Map<string, EchartsPreset[]>();
  for (const p of presets) {
    const list = byFamily.get(p.family) ?? [];
    list.push(p);
    byFamily.set(p.family, list);
  }
  return listEchartsFamilyMeta()
    .filter((f) => byFamily.has(f.id))
    .map((family) => ({
      family,
      presets: byFamily.get(family.id)!,
    }));
}
