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

/** Status core panel — V5 generic semantic renderer (readings mode). */
export function StatusPanel({ capabilities, layout = "card", direction = "across", itemStyle = "auto" }: Props) {
  return (
    <GenericSemanticPanel
      capabilities={capabilities}
      mode="readings"
      layout={layout}
      direction={direction}
      itemStyle={itemStyle}
    />
  );
}
