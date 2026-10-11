import type { ResolvedPanelCapability } from "../api";
import type {
  PanelAppearanceLayout,
  PanelItemDirection,
  PanelItemStyle,
} from "../lib/panel-appearance";
import { GenericSemanticPanel } from "./semantic";

type Props = {
  capabilities: ResolvedPanelCapability[];
  layout?: PanelAppearanceLayout;
  direction?: PanelItemDirection;
  itemStyle?: PanelItemStyle;
};

/** Controls core panel — V5 generic semantic renderer (controls mode). */
export function ControlsPanel({ capabilities, layout = "card", direction = "across", itemStyle = "auto" }: Props) {
  return (
    <GenericSemanticPanel
      capabilities={capabilities}
      mode="controls"
      layout={layout}
      direction={direction}
      itemStyle={itemStyle}
    />
  );
}
