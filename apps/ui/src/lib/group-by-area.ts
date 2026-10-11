/** Group pick-list items by area name; areas A–Z, items without an area last. */
export function groupByArea<T>(
  items: readonly T[],
  areaOf: (item: T) => string | null | undefined
): { area: string; items: T[] }[] {
  const NO_AREA = "No area";
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const area = areaOf(item)?.trim() || NO_AREA;
    const list = groups.get(area) ?? [];
    list.push(item);
    groups.set(area, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === NO_AREA ? 1 : b === NO_AREA ? -1 : a.localeCompare(b)))
    .map(([area, list]) => ({ area, items: list }));
}
