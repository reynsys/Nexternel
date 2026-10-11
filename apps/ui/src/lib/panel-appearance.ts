export type PanelAppearanceLayout = "card" | "compact" | "grid";

/** How several readings share the main tile. */
export type PanelItemDirection = "across" | "down";

/** Several readings as tiles, as a list, or whichever fits the panel (default). */
export type PanelItemStyle = "auto" | "tiles" | "list";

export function readPanelItemStyle(config: Record<string, unknown> | undefined): PanelItemStyle {
  const appearance = config?.appearance;
  if (appearance && typeof appearance === "object" && !Array.isArray(appearance)) {
    const style = (appearance as Record<string, unknown>).itemStyle;
    if (style === "tiles" || style === "list") return style;
  }
  return "auto";
}

export function readPanelAppearanceLayout(
  config: Record<string, unknown> | undefined
): PanelAppearanceLayout {
  const appearance = config?.appearance;
  if (appearance && typeof appearance === "object" && !Array.isArray(appearance)) {
    const layout = (appearance as Record<string, unknown>).layout;
    if (layout === "compact" || layout === "grid" || layout === "card") {
      return layout;
    }
  }
  return "card";
}

export function readPanelItemDirection(
  config: Record<string, unknown> | undefined
): PanelItemDirection {
  const appearance = config?.appearance;
  if (appearance && typeof appearance === "object" && !Array.isArray(appearance)) {
    const direction = (appearance as Record<string, unknown>).direction;
    if (direction === "down") return "down";
  }
  return "across";
}
