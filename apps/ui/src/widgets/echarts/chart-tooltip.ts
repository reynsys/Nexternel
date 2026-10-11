/** Keep axis/item tooltips visible when chart hosts use overflow:hidden (dashboard grid). */
export function applySafeChartTooltip(
  option: Record<string, unknown>
): Record<string, unknown> {
  const tooltip = option.tooltip;
  const base =
    tooltip && typeof tooltip === "object" && !Array.isArray(tooltip)
      ? (tooltip as Record<string, unknown>)
      : {};
  return {
    ...option,
    tooltip: {
      ...base,
      confine: true,
      appendToBody: true,
    },
  };
}
