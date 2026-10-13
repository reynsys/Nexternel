import { createContext, useContext } from "react";
import type { PanelHeading } from "./panel-heading";
import { DEFAULT_ITEM_DISPLAY, type PanelItemDisplay } from "./panel-item-display";
import type { StatusLook } from "../components/status-light/StatusLight";

export type PanelTitleTileSnapshot = PanelHeading & {
  rangeNote: string | null;
};

export type DashboardTileChrome = {
  /** When false, widget bodies must not render their own headings (the title tile owns the title). */
  showBodyHeading: boolean;
  /**
   * When false, the title tile already shows the area, so item content must not repeat it.
   * Multi-item panels leave this true so each item can show its own area.
   */
  showItemContext: boolean;
  /**
   * When false, the title tile already shows the only item's name.
   * Multi-item panels leave this true so each item can show its name at the top.
   */
  showItemLabel: boolean;
  /** Dashboard panels only: title tile computed in SectionGrid (null elsewhere). */
  titleTile: PanelTitleTileSnapshot | null;
  /** The panel's Names & icons settings for its items. */
  itemDisplay: PanelItemDisplay;
  /** How this panel shows status lights (absent outside dashboards = no lights). */
  statusLook?: StatusLook | null;
};

const defaultChrome: DashboardTileChrome = {
  showBodyHeading: true,
  showItemContext: true,
  showItemLabel: true,
  titleTile: null,
  itemDisplay: DEFAULT_ITEM_DISPLAY,
};

export const DashboardTileContext = createContext<DashboardTileChrome>(defaultChrome);

export function useDashboardTileChrome(): DashboardTileChrome {
  return useContext(DashboardTileContext);
}
