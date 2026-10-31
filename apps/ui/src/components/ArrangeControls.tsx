import { Box, Button, Tooltip } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { DashboardSummary } from "../api";
import type { ArrangeDashboards } from "../lib/use-arrange-dashboards";
import { ButtonRow } from "./ButtonRow";
import { ICON_SIZE } from "../lib/appearance/type";
import { choiceSx } from "../skins/surfaceStyles";

/**
 * The grip on a dashboard while arranging: press and drag it to a new place. Beside the name, or
 * (`corner`) as a small badge in the corner of an icon-only button.
 */
export function ArrangeGrip({ d, arrange, corner = false }: { d: DashboardSummary; arrange: ArrangeDashboards; corner?: boolean }) {
  if (!arrange.enabled) return null;
  return (
    <Box
      component="span"
      aria-hidden
      data-nx-arrange-grip=""
      {...arrange.gripProps(d)}
      sx={[
        {
          display: "inline-flex",
          alignItems: "center",
          cursor: arrange.draggingId === d.id ? "grabbing" : "grab",
          // The finger drags the dashboard instead of scrolling the row.
          touchAction: "none",
          ...(corner
            ? { position: "absolute", top: -6, left: -6, color: "primary.main", zIndex: 1 }
            : { ml: -0.5, mr: 0.25, color: "inherit", opacity: 0.85 }),
        },
        // A small badge in the corner of an icon-only room: the Look's (chosen) choice box.
        corner ? choiceSx(true, { radius: "field" }) : {},
      ]}
    >
      <DragIndicatorIcon sx={{ fontSize: corner ? ICON_SIZE.inline : ICON_SIZE.title }} />
    </Box>
  );
}

/** Move the open dashboard one place back or forward (left/right in a row, up/down in a column). */
export function ArrangeArrows({
  d,
  index,
  count,
  arrange,
  axis,
  layout = axis,
  size = 30,
}: {
  d: DashboardSummary;
  index: number;
  count: number;
  arrange: ArrangeDashboards;
  /** Which way the dashboards run (left/right or up/down). */
  axis: "row" | "column";
  /** How the two buttons sit together (default: the same way). */
  layout?: "row" | "column";
  size?: number;
}) {
  if (!arrange.enabled || count < 2) return null;
  const back = axis === "row" ? "left" : "up";
  const forward = axis === "row" ? "right" : "down";
  const button = (dir: -1 | 1) => {
    const word = dir < 0 ? back : forward;
    const Icon = axis === "row" ? (dir < 0 ? ChevronLeftIcon : ChevronRightIcon) : dir < 0 ? ExpandLessIcon : ExpandMoreIcon;
    return (
      <Tooltip title={`Move ${d.name} ${word}`}>
        <span>
          <Button
            variant="outlined"
            aria-label={`Move ${d.name} ${word}`}
            disabled={dir < 0 ? index === 0 : index === count - 1}
            onClick={() => arrange.move(d.id, dir)}
            sx={{ minWidth: size, width: size, height: size, p: 0, flexShrink: 0 }}
          >
            <Icon fontSize="small" />
          </Button>
        </span>
      </Tooltip>
    );
  };
  return (
    <ButtonRow direction={layout} flexWrap="nowrap" sx={{ flexShrink: 0 }}>
      {button(-1)}
      {button(1)}
    </ButtonRow>
  );
}
