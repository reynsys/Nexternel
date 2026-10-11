/** Deep-merge plain objects; arrays and non-objects are replaced. */
export function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown> | undefined | null
): Record<string, unknown> {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return { ...base };
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const prev = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key] = deepMerge(
        prev as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Merge preset option with Advanced JSON override.
 * If override does not set series[].data, keep bound data from base series by index.
 */
export function buildFinalOption(
  base: Record<string, unknown>,
  optionOverride: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!optionOverride || Object.keys(optionOverride).length === 0) {
    return base;
  }
  const merged = deepMerge(base, optionOverride);
  const baseSeries = base.series;
  const mergedSeries = merged.series;
  if (Array.isArray(baseSeries) && Array.isArray(mergedSeries)) {
    merged.series = mergedSeries.map((s, i) => {
      if (!s || typeof s !== "object" || Array.isArray(s)) return s;
      const series = { ...(s as Record<string, unknown>) };
      const overrideSeries = optionOverride.series;
      const overrideItem =
        Array.isArray(overrideSeries) &&
        overrideSeries[i] &&
        typeof overrideSeries[i] === "object" &&
        !Array.isArray(overrideSeries[i])
          ? (overrideSeries[i] as Record<string, unknown>)
          : null;
      if (!overrideItem || !("data" in overrideItem)) {
        const baseItem = baseSeries[i];
        if (baseItem && typeof baseItem === "object" && !Array.isArray(baseItem)) {
          const bd = (baseItem as Record<string, unknown>).data;
          if (bd !== undefined) series.data = bd;
        }
      }
      return series;
    });
  }
  return merged;
}
