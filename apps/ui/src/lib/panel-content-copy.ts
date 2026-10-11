import { normalizePanelKind } from "./panel-kind";

/** Contextual heading for item pickers by panel kind. */
export function panelItemPickerHeading(panelKind: string): string {
  const kind = normalizePanelKind(panelKind);
  switch (kind) {
    case "panel.status":
      return "What to show";
    case "panel.controls":
      return "What to control";
    case "panel.charts":
      return "What to chart";
    case "panel.camera":
      return "Which cameras";
    default:
      return "What to include";
  }
}

/** Plugin / single-source panel picker heading. */
export const PLUGIN_ITEM_PICKER_HEADING = "What to use";

export const PANEL_CONTENT_MODE_LABELS = {
  auto: "Show all matching",
  manual: "Choose specific items",
} as const;

export const PANEL_CONTENT_MODE_HELP = {
  auto:
    "Include everything that fits this panel, place and category. New matching items will appear automatically.",
  manual:
    "Only show the items you choose. New items will not be added automatically.",
} as const;
