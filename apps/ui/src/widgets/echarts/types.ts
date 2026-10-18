import type { WidgetCategoryId } from "@nexternel/plugin-sdk";
import type { HistoryRange } from "../../api";
import type { EchartsThemePalette } from "./chart-theme";

export type EchartsDataMode = "live" | "history" | "none";

export type HistoryPoint = { t: string; v: number };

export type EchartsBuildCtx = {
  value: number;
  unit: string;
  title: string;
  kind: string;
  min: number;
  max: number;
  accent?: string;
  /** From System → Appearance (accent + readable axis/detail colours). */
  palette?: EchartsThemePalette;
  points: HistoryPoint[];
  range: HistoryRange;
  /** Main tile size in pixels. Dial writing follows the shorter side. */
  tileWidth?: number;
  tileHeight?: number;
  /** Settings → Appearance → Text size as a factor (1 = Normal); chart text follows it. */
  textScale?: number;
};

/** Smallest chart/dial text that stays readable (px at Normal text size). */
export const MIN_CHART_FONT = 11;

/** A chart text size: never below readable, and following the person's text size. */
export function chartFont(ctx: Pick<EchartsBuildCtx, "textScale">, px: number): number {
  return Math.round(Math.max(px, MIN_CHART_FONT) * (ctx.textScale ?? 1));
}

export type EchartsPreset = {
  id: string;
  label: string;
  description: string;
  family: string;
  category: WidgetCategoryId;
  dataMode: EchartsDataMode;
  defaultSize: { w: number; h: number };
  /** Needs a capability binding (false only for blank / system shells). */
  needsCapability: boolean;
  buildOption: (ctx: EchartsBuildCtx) => Record<string, unknown>;
};

export type EchartsWidgetConfig = {
  presetId: string;
  range?: HistoryRange;
  min?: number;
  max?: number;
  accent?: string;
  optionOverride?: Record<string, unknown>;
};
