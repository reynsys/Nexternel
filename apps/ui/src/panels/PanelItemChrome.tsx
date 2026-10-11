import { Box, alpha } from "@mui/material";
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
  fontWeight: 600,
  fontSize: "0.75rem",
  lineHeight: `${ITEM_NAME_LINE_PX}px`,
  height: ITEM_NAME_LINE_PX,
  color: "text.primary",
} as const;

const itemAreaSx = {
  ...singleLineSx,
  fontSize: "0.6875rem",
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
  /** Lay the name over the content's top-left corner (video) instead of above it. */
  overlay?: boolean;
  children: ReactNode;
  contentSx?: SxProps<Theme>;
};

/**
 * One item of a panel, in its own tile. With several items the tile carries the item's
 * icon, name, and (when it differs from the title strip) area in its top-left corner.
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
  overlay = false,
  children,
  contentSx,
}: Props) {
  const { showItemContext, titleTile, itemDisplay } = useDashboardTileChrome();
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
  if (areaText && areaText.toLowerCase() === panelArea) areaText = null;
  const iconSx = { fontSize: 16, mt: "1px", flexShrink: 0, color: "primary.main" } as const;
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

  const heading = nameText || iconNode ? (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: "6px", minWidth: 0 }}>
      {iconNode}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {nameText ? (
          <Box component="p" title={nameText} sx={itemNameSx}>
            {nameText}
          </Box>
        ) : null}
        {reserveArea ? (
          <Box component="p" title={areaText ?? undefined} sx={itemAreaSx}>
            {areaText ?? " "}
          </Box>
        ) : null}
      </Box>
    </Box>
  ) : null;

  return (
    <PanelTile>
      {heading && !overlay ? (
        <Box sx={{ flexShrink: 0, px: "10px", pt: "8px" }}>{heading}</Box>
      ) : null}
      <Box sx={panelContentRootSx(contentSx)}>{children}</Box>
      {heading && overlay ? (
        <Box
          sx={(theme) => ({
            position: "absolute",
            top: 8,
            left: 8,
            maxWidth: "calc(100% - 16px)",
            px: "8px",
            py: "4px",
            borderRadius: 1,
            bgcolor: alpha(theme.palette.background.default, 0.72),
            backdropFilter: "blur(4px)",
            pointerEvents: "none",
            zIndex: 1,
          })}
        >
          {heading}
        </Box>
      ) : null}
    </PanelTile>
  );
}
