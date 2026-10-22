import { Typography } from "@mui/material";
import { PanelItemGrid } from "../../components/PanelItemGrid";
import { PanelTile } from "../../components/PanelTile";
import type {
  PanelAppearanceLayout,
  PanelItemDirection,
  PanelItemStyle,
} from "../../lib/panel-appearance";
import { itemTilesLayout } from "../../lib/panel-item-grid";
import { usePanelSize } from "../../lib/panel-size-context";
import { panelContentContainerSx } from "../../components/DashboardTileBody";
import { usePanelResponsiveSemanticState } from "../responsive";
import { composeSemanticPanel } from "./compose";
import { SemanticCapabilityList } from "./SemanticCapabilityList";
import { SemanticCapabilityTile } from "./SemanticCapabilityTile";
import type { SemanticPanelMode } from "./types";
import type { ResolvedPanelCapability } from "../../api";

type Props = {
  capabilities: ResolvedPanelCapability[];
  mode: SemanticPanelMode;
  layout?: PanelAppearanceLayout;
  direction?: PanelItemDirection;
  itemStyle?: PanelItemStyle;
};

/**
 * Status / Controls body. Every item is shown: as one tile each while the tiles fit at a
 * readable size, otherwise as one list. Classifies by presentation semantics, not device
 * identity (LAW 031).
 */
export function GenericSemanticPanel({
  capabilities,
  mode,
  layout = "card",
  direction = "across",
  itemStyle = "auto",
}: Props) {
  const { state } = usePanelResponsiveSemanticState();
  const size = usePanelSize();
  const composition = composeSemanticPanel(capabilities, mode);
  const items = composition.items;
  const showSecondary = state === "comfortable" || state === "compact";

  if (items.length === 0) {
    return (
      <PanelTile sx={{ alignItems: "center", justifyContent: "center", p: 1.5 }}>
        <Typography color="text.secondary" role="status" variant="body2" textAlign="center">
          {composition.emptyMessage}
        </Typography>
      </PanelTile>
    );
  }

  // Tiles while they have the room, then compact tiles (one line each), then a list.
  const fit = items.length > 1 ? itemTilesLayout({ count: items.length, width: size.width, height: size.height, direction }) : "tiles";
  const asList = items.length > 1 && (itemStyle === "list" || (itemStyle === "auto" && fit === "list"));

  if (asList) {
    return <SemanticCapabilityList items={items} />;
  }

  const rowSize = (mode === "controls" && items.length === 1) || fit === "compact" ? "fluid" : "standard";
  return (
    <PanelItemGrid
      layout={layout}
      direction={direction}
      rowSize={rowSize}
      itemCount={items.length}
      rootSx={panelContentContainerSx()}
    >
      {items.map((item) => (
        <SemanticCapabilityTile
          key={item.id}
          item={item}
          layout={layout}
          showSecondary={showSecondary}
        />
      ))}
    </PanelItemGrid>
  );
}
