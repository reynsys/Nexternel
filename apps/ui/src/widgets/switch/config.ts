export const SWITCH_WIDGET_TYPES = [
  "switch",
  "switch_icon",
  "switch_power",
  "switch_pill",
  "switch_compact",
  "switch_button",
  "switch_momentary",
] as const;

export type SwitchWidgetType = (typeof SWITCH_WIDGET_TYPES)[number];

export type SwitchButtonPriority = "contained" | "outlined" | "text";

export function isSwitchWidgetType(type: string): boolean {
  return SWITCH_WIDGET_TYPES.includes(type as SwitchWidgetType);
}

export function switchWidgetLabel(type: string): string {
  switch (type) {
    case "switch_icon":
      return "Icon tile";
    case "switch_power":
      return "Power button";
    case "switch_pill":
      return "ON / OFF buttons";
    case "switch_compact":
      return "Compact switch";
    case "switch_button":
      return "Action button";
    case "switch_momentary":
      return "Momentary pulse";
    default:
      return "Switch";
  }
}

export function switchUsesIcon(type: string): boolean {
  return (
    type === "switch_icon" ||
    type === "switch_power" ||
    type === "switch_compact" ||
    type === "switch_button" ||
    type === "switch_momentary"
  );
}

export function switchUsesButtonPriority(type: string): boolean {
  return type === "switch_button";
}

export function switchIsMomentary(type: string): boolean {
  return type === "switch_momentary";
}

export type SwitchWidgetConfig = {
  iconId: string;
  buttonPriority: SwitchButtonPriority;
  showButtonIcon: boolean;
  pulseMs: number;
};

function parseButtonPriority(value: unknown): SwitchButtonPriority {
  if (value === "outlined" || value === "text") return value;
  return "contained";
}

export function parseSwitchConfig(
  config: Record<string, unknown> | undefined
): SwitchWidgetConfig {
  const iconId =
    typeof config?.iconId === "string" && config.iconId.trim()
      ? config.iconId.trim()
      : "lights";
  const buttonPriority = parseButtonPriority(config?.buttonPriority);
  const showButtonIcon = config?.showButtonIcon !== false;
  const pulseRaw =
    typeof config?.pulseMs === "number"
      ? config.pulseMs
      : typeof config?.pulseMs === "string"
        ? Number(config.pulseMs)
        : 500;
  const pulseMs = Number.isFinite(pulseRaw)
    ? Math.min(5000, Math.max(100, Math.round(pulseRaw)))
    : 500;
  return { iconId, buttonPriority, showButtonIcon, pulseMs };
}

export function defaultSwitchConfig(type: string): Record<string, unknown> {
  if (type === "switch_button") {
    return {
      iconId: "lights",
      buttonPriority: "contained",
      showButtonIcon: true,
    };
  }
  if (type === "switch_momentary") {
    return { iconId: "power", pulseMs: 500, showButtonIcon: true };
  }
  if (switchUsesIcon(type)) {
    return { iconId: "lights" };
  }
  return {};
}

export function switchDefaultLayout(type: string): {
  w: number;
  h: number;
  minW: number;
  minH: number;
} {
  switch (type) {
    case "switch_icon":
    case "switch_power":
      return { w: 2, h: 2, minW: 2, minH: 2 };
    case "switch_button":
    case "switch_momentary":
      return { w: 3, h: 2, minW: 2, minH: 2 };
    case "switch_pill":
      return { w: 3, h: 2, minW: 3, minH: 2 };
    case "switch_compact":
      return { w: 3, h: 2, minW: 2, minH: 2 };
    default:
      return { w: 3, h: 2, minW: 2, minH: 2 };
  }
}
