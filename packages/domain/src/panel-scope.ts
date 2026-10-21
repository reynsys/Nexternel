import { z } from "zod";
import { SystemIdSchema } from "./system.js";

/** Registered Panel kinds — see docs/v3/09-VIEW-REGISTRY.md */
export const PANEL_KINDS = [
  "panel.controls",
  "panel.status",
  "panel.charts",
  "panel.camera",
  "panel.weather",
  "panel.calendar",
  "panel.clock",
  "panel.devices",
  "panel.system",
  "panel.rooms",
] as const;

export type PanelKind = (typeof PANEL_KINDS)[number];

/** @deprecated Retired panel kinds — normalized on read for dashboard migration. */
export const DEPRECATED_PANEL_KINDS = [
  "panel.garden",
  "panel.garage",
  "panel.network",
  "panel.media",
  "panel.appliances",
  "panel.health",
  "panel.climate",
  "panel.environment",
  "panel.energy",
  "panel.security",
  "panel.water",
] as const;

export type DeprecatedPanelKind = (typeof DEPRECATED_PANEL_KINDS)[number];

/**
 * Map persisted/legacy type strings to canonical Panel kinds.
 *
 * Special cases:
 * - `view.lighting` → controls (lighting profile consolidated into Controls)
 * - `view.garden` → controls (retired `panel.garden`; garden multi-system UI → Controls)
 *
 * Other `view.*` → `panel.*` by suffix. Deprecated `panel.*` profile kinds are
 * consolidated later in dashboard normalization (`replaceDeprecatedPanelKind`).
 */
export function normalizePanelKind(kind: string): string {
  if (kind === "view.lighting") return "panel.controls";
  if (kind === "view.garden") return "panel.controls";
  if (kind.startsWith("view.")) return kind.replace(/^view\./, "panel.");
  return kind;
}

export function isPanelKind(value: string): value is PanelKind {
  const normalized = normalizePanelKind(value);
  return (PANEL_KINDS as readonly string[]).includes(normalized);
}

export const PanelKindSchema = z.preprocess(
  (val) => (typeof val === "string" ? normalizePanelKind(val) : val),
  z.enum(PANEL_KINDS)
);

export const PanelContentModeSchema = z.enum(["auto", "manual"]);
export type PanelContentMode = z.infer<typeof PanelContentModeSchema>;

/**
 * Which capabilities a Panel instance displays.
 * Stored in dashboard JSON as `config.panelScope`.
 *
 * Empty arrays mean no explicit restriction on that dimension.
 * Section area inheritance is applied at resolve time when enabled.
 *
 * `contentMode` is explicit when set. Legacy dashboards without it infer mode from
 * `capabilityIds`: non-empty → manual, empty → auto.
 */
export const PanelScopeSchema = z.object({
  inheritSectionArea: z.boolean().optional(),
  areaIds: z.array(z.string().uuid()).default([]),
  systemIds: z.array(SystemIdSchema).default([]),
  groupIds: z.array(z.string().uuid()).default([]),
  contentMode: PanelContentModeSchema.optional(),
  /** Manual mode only — order preserved for display. Ignored when contentMode is auto. */
  capabilityIds: z.array(z.string().uuid()).default([]),
  /** Camera panel manual mode — order preserved. Ignored when contentMode is auto. */
  cameraIds: z.array(z.string().uuid()).default([]),
});

export type PanelScope = z.infer<typeof PanelScopeSchema>;

/** Resolve auto vs manual from stored scope (backward compatible). Reads only the fields below. */
export function resolvePanelContentMode(scope: {
  contentMode?: PanelContentMode;
  capabilityIds: readonly string[];
  cameraIds: readonly string[];
}): PanelContentMode {
  if (scope.contentMode === "auto" || scope.contentMode === "manual") {
    return scope.contentMode;
  }
  if (scope.capabilityIds.length > 0 || scope.cameraIds.length > 0) {
    return "manual";
  }
  return "auto";
}

/** Default content mode when creating a new panel of this kind. */
export function defaultPanelContentMode(panelKind: string): PanelContentMode {
  const kind = normalizePanelKind(panelKind);
  if (
    kind === "panel.charts" ||
    kind === "panel.controls" ||
    kind === "panel.status" ||
    kind === "panel.camera"
  ) {
    return "manual";
  }
  return "auto";
}
