/**
 * The line under a panel's title is always an area. "auto": the area(s) of what the panel shows;
 * "area": an area the person chose (its name kept too, for an area no device is in); "none": no line.
 * Stored in the panel's config as `areaLine` (absent = auto).
 */
export type PanelAreaLine = { mode: "auto" } | { mode: "area"; areaId: string; name: string } | { mode: "none" };

export const AUTO_AREA_LINE: PanelAreaLine = { mode: "auto" };

export function readPanelAreaLine(config: Record<string, unknown> | null | undefined): PanelAreaLine {
  const raw = config?.areaLine as Partial<{ mode: string; areaId: string; name: string }> | undefined;
  if (raw?.mode === "none") return { mode: "none" };
  if (raw?.mode === "area" && typeof raw.areaId === "string" && raw.areaId) {
    return { mode: "area", areaId: raw.areaId, name: typeof raw.name === "string" ? raw.name : "" };
  }
  return AUTO_AREA_LINE;
}

/** The config with this choice in it (automatic leaves nothing behind). */
export function withPanelAreaLine(config: Record<string, unknown>, line: PanelAreaLine): Record<string, unknown> {
  const next = { ...config };
  if (line.mode === "auto") delete next.areaLine;
  else next.areaLine = line;
  return next;
}

/**
 * The automatic line from the areas of what a panel shows: one area → its name; two or three →
 * their names ("Living Room · Kids Bedroom"); more → "4 areas"; none → no line.
 */
export function areaLineFromAreas(areas: readonly (string | null | undefined)[]): string | null {
  const seen = new Map<string, string>();
  for (const a of areas) {
    const name = a?.trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  const names = [...seen.values()];
  if (names.length === 0) return null;
  if (names.length <= 3) return names.join(" · ");
  return `${names.length} areas`;
}
