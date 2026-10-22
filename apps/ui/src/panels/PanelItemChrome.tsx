import { ICON_SIZE, ITEM_AREA_SIZE, ITEM_TITLE_SIZE } from "../lib/appearance/type";
import { Box } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import type { Capability, ResolvedPanelCapability } from "../api";
import { panelContentRootSx } from "../components/DashboardTileBody";
import { PanelTile } from "../components/PanelTile";
import { useDashboardTileChrome } from "../lib/dashboard-tile-context";
import { ItemIcon } from "../lib/icons/ItemIcon";
import { resolveItemHeading } from "../lib/panel-item-display";
import { panelItemContextLine } from "./panel-item-context";
import { StatusLight, lightPlacement } from "../components/status-light/StatusLight";
import { ITEM_TILE_MIN_HEIGHT_PX } from "../lib/panel-item-grid";

const ITEM_NAME_LINE_PX = 18;
const ITEM_AREA_LINE_PX = 16;

const singleLineSx = {
  margin: 0,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  textAlign: "left",
} as const;

/** Item name inside its tile — shared by every multi-item panel. */
export const itemNameSx = {
  ...singleLineSx,
  fontWeight: "fontWeightBold",
  fontSize: ITEM_TITLE_SIZE,
  lineHeight: `${ITEM_NAME_LINE_PX}px`,
  height: ITEM_NAME_LINE_PX,
  color: "text.primary",
} as const;

const itemAreaSx = {
  ...singleLineSx,
  fontSize: ITEM_AREA_SIZE,
  lineHeight: `${ITEM_AREA_LINE_PX}px`,
  height: ITEM_AREA_LINE_PX,
  color: "text.secondary",
} as const;

type Props = {
  cap?: Capability | ResolvedPanelCapability;
  /** Override computed context (e.g. camera area name). */
  contextLabel?: string | null;
  /** Item name when this panel holds several items. */
  title?: string | null;
  /** When false, skip the context caption entirely. */
  showContext?: boolean;
  /** Icon beside the name for items that are not readings (cameras); readings use their own icon. */
  icon?: SvgIconComponent;
  /** Item id for this panel's own name / icon (defaults to the reading's id). */
  itemId?: string;
  children: ReactNode;
  contentSx?: SxProps<Theme>;
};

/**
 * One item of a panel. With several items each is a small panel of its own: the item's icon,
 * name, area (when it differs from the title strip) and status light on top, its tile below.
 * Every item in a panel reserves the same heading height, so values line up.
 * With one item the title strip already names it, so the tile holds only the content.
 */
export function PanelItemChrome({
  cap,
  contextLabel,
  title,
  showContext = true,
  icon,
  itemId,
  children,
  contentSx,
}: Props) {
  const { showItemContext, titleTile, itemDisplay, statusLook } = useDashboardTileChrome();
  const panelArea = titleTile?.area?.trim().toLowerCase() || null;
  // A tile with no title is the panel's only item: the title strip names it, so no heading here.
  const resolved = title?.trim()
    ? resolveItemHeading({
        itemId: itemId ?? cap?.id,
        title,
        readingIcon: cap && "icon" in cap ? cap.icon : null,
        prefix: titleTile?.itemPrefix ?? null,
        display: itemDisplay,
      })
    : { name: null, iconId: null };
  const nameText = resolved.name;
  const reserveArea = Boolean(nameText) && showContext && showItemContext;
  let areaText = reserveArea
    ? (contextLabel !== undefined ? contextLabel : cap ? panelItemContextLine(cap) : null)?.trim() || null
    : null;
  // Same rule as the title strip: an area that repeats the panel's area or the item's own name adds nothing.
  if (areaText && (areaText.toLowerCase() === panelArea || areaText.toLowerCase() === nameText?.trim().toLowerCase())) {
    areaText = null;
  }
  const iconSx = { fontSize: ICON_SIZE.inline, mt: "1px", flexShrink: 0, color: "primary.main" } as const;
  const overrideIcon = itemId ? itemDisplay.overrides[itemId]?.icon : undefined;
  let iconNode: ReactNode = null;
  if (resolved.iconId !== null) {
    if (icon && !overrideIcon) {
      const Fixed = icon;
      iconNode = <Fixed aria-hidden sx={iconSx} />;
    } else if (cap || overrideIcon) {
      iconNode = <ItemIcon iconId={resolved.iconId} kind={cap?.kind} sx={iconSx} />;
    }
  }

  // Each reading of a several-reading panel is a small panel of its own: a title row (icon,
  // name, area, status light) above its own tile.
  const lightCap = cap && statusLook ? cap : null;
  const lightAt = (placement: ReturnType<typeof lightPlacement>) =>
    placement && lightCap && statusLook ? (
      <StatusLight capabilityId={lightCap.id} kind={lightCap.kind} unit={lightCap.unit} look={statusLook} placement={placement} />
    ) : null;
  const titlePlacement = statusLook ? lightPlacement(statusLook, "title") : null;
  const readingPlacement = statusLook ? lightPlacement(statusLook, "reading") : null;

  const heading = nameText || iconNode ? (
    // A title row like the panel's own: its status light takes less room when the row is narrow.
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: "6px", minWidth: 0, containerType: "inline-size", containerName: "nx-title" }}>
      {iconNode}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {nameText ? (
          <Box component="p" title={nameText} sx={itemNameSx}>
            {nameText}
          </Box>
        ) : null}
        {reserveArea ? (
          <Box component="p" data-nx-item-area="" title={areaText ?? undefined} sx={itemAreaSx}>
            {areaText ?? " "}
          </Box>
        ) : null}
      </Box>
      {titlePlacement === "inline" ? <Box sx={{ alignSelf: "center" }}>{lightAt("inline")}</Box> : null}
    </Box>
  ) : null;

  if (!heading) {
    // The panel's only item: the panel's own title tile names it and carries its light.
    return (
      <PanelTile>
        <Box sx={panelContentRootSx(contentSx)}>{children}</Box>
      </PanelTile>
    );
  }

  return (
    // The reading's own box: a size container, so a short one lays its name and value side by side.
    <Box sx={{ flex: 1, width: "100%", height: "100%", minHeight: 0, minWidth: 0, containerType: "size", containerName: "nx-item" }}>
    <Box
      data-nx-mini-panel
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        p: "3px",
        border: "var(--nx-mini-panel-border, 1px solid rgba(255,255,255,0.12))",
        borderRadius: "var(--nx-mini-panel-radius, 12px)",
        // Too short for name above value: one line, name on the left and value on the right.
        [`@container nx-item (max-height: ${ITEM_TILE_MIN_HEIGHT_PX - 1}px)`]: {
          flexDirection: "row",
          alignItems: "stretch",
          "& > [data-nx-item-heading]": { flex: "1 1 55%", display: "flex", flexDirection: "column", justifyContent: "center", pb: "5px" },
          "& > [data-nx-panel-tile]": { flex: "1 1 45%" },
        },
        // Very short: the name only (the area line goes).
        "@container nx-item (max-height: 55px)": { "& [data-nx-item-area]": { display: "none" } },
      }}
    >
      {titlePlacement === "frame" ? lightAt("frame") : null}
      <Box data-nx-item-heading="" sx={{ position: "relative", flexShrink: 0, minWidth: 0, px: "7px", pt: "5px", pb: "8px" }}>
        {heading}
        {titlePlacement === "under-title" ? lightAt("under-title") : null}
      </Box>
      <PanelTile>
        {lightAt(readingPlacement)}
        <Box sx={panelContentRootSx(contentSx)}>{children}</Box>
      </PanelTile>
    </Box>
    </Box>
  );
}
