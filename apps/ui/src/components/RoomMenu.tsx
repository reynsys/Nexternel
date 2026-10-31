import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Box, Button, Stack, Tooltip, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { DashboardSummary } from "../api";
import { getDashboardIcon } from "../lib/dashboard-icons";
import type { RoomNav } from "../lib/room-nav";
import { BOTTOM_NAV_HEIGHT_PX } from "../skins/builtin/mui-dashboard/BottomNav";
import { ARRANGE_ATTR, type ArrangeDashboards } from "../lib/use-arrange-dashboards";
import { ArrangeArrows, ArrangeGrip } from "./ArrangeControls";

type Props = {
  variant: Exclude<RoomNav, "tabs">;
  dashboards: DashboardSummary[];
  activeId?: string;
  loading: boolean;
  error: string | null;
  onGo: (d: DashboardSummary) => void;
  tools: (dir: "row" | "column", size?: number) => ReactNode;
  /** Arranging the dashboards while editing (grip on each, arrows on the open one). */
  arrange: ArrangeDashboards;
};

/** Room width the rail takes when open / folded (the page keeps this much free on the right). */
export const RAIL_OPEN = 200;
export const RAIL_FOLDED = 60;
const RAIL_KEY = "nx-rail-open";

/**
 * The room menu as a dock or a right rail (the top tabs are DashboardTabBar).
 * Every room is a button: the open one filled, like everywhere else.
 */
export function RoomMenu(props: Props) {
  if (props.variant === "dock") return <Dock {...props} />;
  return <Rail {...props} />;
}

function RoomTile({
  d,
  active,
  onGo,
  size,
  label,
  arrange,
  index,
  count,
  axis,
}: {
  d: DashboardSummary;
  active: boolean;
  onGo: () => void;
  size: number;
  label: "beside" | "none";
  arrange: ArrangeDashboards;
  index: number;
  count: number;
  /** Which way the rooms run: the open room's arrows move it along this way. */
  axis: "row" | "column";
}) {
  const Icon = getDashboardIcon(d.tabIcon);
  const dragging = arrange.draggingId === d.id;
  // A real button, so every Look draws rooms like its other buttons (the open room filled).
  const tile = (
    <Button
      onClick={onGo}
      aria-label={d.name}
      aria-current={active ? "page" : undefined}
      data-nx-room=""
      data-nx-active-tab={active ? "" : undefined}
      variant={active ? "contained" : "outlined"}
      startIcon={
        label === "beside" ? (
          <>
            <ArrangeGrip d={d} arrange={arrange} />
            <Icon fontSize="small" />
          </>
        ) : undefined
      }
      sx={{
        minWidth: size,
        height: size,
        px: label === "beside" ? 1.25 : 0,
        flexShrink: 0,
        justifyContent: label === "beside" ? "flex-start" : "center",
        textTransform: "none",
        transition: "transform .12s ease",
        transformOrigin: "bottom center",
        overflow: "visible",
        ...(dragging ? { opacity: 0.6, outline: "2px dashed", outlineColor: "primary.main", outlineOffset: 2 } : {}),
      }}
    >
      {label === "beside" ? (
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {d.name}
        </Box>
      ) : (
        <>
          <ArrangeGrip d={d} arrange={arrange} corner />
          <Icon fontSize="small" />
        </>
      )}
    </Button>
  );
  const shown = label === "beside" ? tile : <Tooltip title={d.name}>{tile}</Tooltip>;
  if (!arrange.enabled) return shown;
  // While arranging: the grip finds this place by its mark; the open room has its arrows under it,
  // so its name keeps its room (at the end of the Rail's row; centred under an icon-only room).
  return (
    <Box
      {...{ [ARRANGE_ATTR]: d.id }}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: label === "beside" ? "stretch" : "center",
        gap: "var(--nx-control-gap)",
        flexShrink: 0,
      }}
    >
      {shown}
      {active ? (
        <Box sx={{ alignSelf: label === "beside" ? "flex-end" : "center" }}>
          <ArrangeArrows d={d} index={index} count={count} arrange={arrange} axis={axis} layout="row" size={label === "beside" ? 26 : 20} />
        </Box>
      ) : null}
    </Box>
  );
}

/** A floating island centred under the dashboard; the room under the pointer grows (like a Mac dock). */
const TILE = 46;
const GROW = 0.22; // the most a room grows; the dock keeps this much room above its rooms
/** Space between the dock and the bottom of the screen (wide screens). */
const DOCK_GAP = 14;
function Dock({ dashboards, activeId, onGo, tools, loading, error, arrange }: Props) {
  const dock = useRef<HTMLDivElement>(null);
  const [centre, setCentre] = useState<number | null>(null);
  // Centre under the dashboard (the dock's own parent), without taking any room in the page.
  useLayoutEffect(() => {
    const el = dock.current?.parentElement;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setCentre(r.left + r.width / 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  // The page keeps room at its end for the dock (its height, its gap to the screen edge and a little
  // air), so the dock never covers the last panel.
  useEffect(() => {
    const el = dock.current;
    if (!el) return undefined;
    const set = () => document.documentElement.style.setProperty("--nx-dock-space", `${Math.ceil(el.offsetHeight) + DOCK_GAP + 12}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--nx-dock-space");
    };
  }, []);
  const frame = useRef(0);
  const magnify = (x: number | null) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      dock.current?.querySelectorAll<HTMLElement>("[data-nx-room]").forEach((k) => {
        if (x === null) {
          k.style.transform = "";
          return;
        }
        const r = k.getBoundingClientRect();
        const dx = Math.abs(x - (r.left + r.width / 2)) / (TILE * 2.2);
        const g = dx >= 1 ? 0 : GROW * (Math.cos(dx * Math.PI) + 1) / 2;
        k.style.transform = `scale(${(1 + g).toFixed(3)})`;
      });
    });
  };
  return (
    <>
      <Box
        ref={dock}
        data-nx-room-menu="dock"
        onMouseMove={(e) => magnify(e.clientX)}
        onMouseLeave={() => magnify(null)}
        sx={(t) => ({
          position: "fixed",
          zIndex: t.zIndex.appBar,
          // On phones it sits just above the phone's own menu bar.
          bottom: { xs: `calc(${BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom) + 8px)`, md: DOCK_GAP },
          left: { xs: 8, md: centre === null ? "50%" : `${centre}px` },
          right: { xs: 8, md: "auto" },
          transform: { xs: "none", md: "translateX(-50%)" },
          maxWidth: { xs: "none", md: "calc(100vw - 32px)" },
          display: "flex",
          alignItems: "flex-end",
          gap: "calc(var(--nx-control-gap) + 2px)",
          px: 2,
          // Room above the rooms so a growing room stays inside the dock.
          pt: `${Math.ceil(TILE * GROW) + 10}px`,
          pb: "10px",
          overflowX: { xs: "auto", md: "visible" },
          scrollbarWidth: "none",
          borderRadius: t.nx.radiusCard,
          // A frame, like the side menu (the Look's chrome), floating with the pop-up shadow.
          border: t.nx.chromeEdge,
          bgcolor: t.nx.chromeFill,
          backdropFilter: t.nxScheme.surfaces === "glass" ? "blur(14px)" : "none",
          boxShadow: t.nx.popupShadow,
          "& [data-nx-room]": { transition: "transform .18s cubic-bezier(.2,.7,.3,1)", transformOrigin: "bottom center", willChange: "transform" },
        })}
      >
        {loading ? <Typography variant="caption">Loading rooms…</Typography> : null}
        {error ? <Typography variant="caption" color="error">{error}</Typography> : null}
        {dashboards.map((d, i) => (
          <RoomTile key={d.id} d={d} active={d.id === activeId} onGo={() => onGo(d)} size={TILE} label="none" arrange={arrange} index={i} count={dashboards.length} axis="row" />
        ))}
        <Box sx={{ width: "1px", alignSelf: "stretch", bgcolor: "divider", mx: 0.5, flexShrink: 0 }} />
        {tools("row", TILE)}
      </Box>

    </>
  );
}

/** Gap between the floating rail and the right edge of the screen. */
const RAIL_EDGE = 14;

/**
 * A floating island on the right, centred top to bottom; it grows with the rooms (and scrolls when
 * they no longer fit). Fold button on top, rooms in the middle, the bell and Dashboard Options at the bottom.
 */
function Rail({ dashboards, activeId, onGo, tools, arrange }: Props) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(RAIL_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const width = open ? RAIL_OPEN : RAIL_FOLDED;
  useEffect(() => {
    try {
      localStorage.setItem(RAIL_KEY, open ? "1" : "0");
    } catch {
      /* per-browser convenience only */
    }
    // The page keeps the rail's width plus its gap free on the right.
    document.documentElement.style.setProperty("--nx-rail-width", `${width + RAIL_EDGE}px`);
    return () => {
      document.documentElement.style.removeProperty("--nx-rail-width");
    };
  }, [open, width]);
  const SIZE = 42;
  return (
    <Box
      data-nx-room-menu="rail"
      sx={(t) => ({
        position: "fixed",
        zIndex: t.zIndex.appBar,
        top: "50%",
        right: RAIL_EDGE,
        transform: "translateY(-50%)",
        width,
        maxHeight: `calc(100vh - ${RAIL_EDGE * 2}px)`,
        display: "flex",
        flexDirection: "column",
        gap: "var(--nx-list-gap)",
        p: 1,
        borderRadius: t.nx.radiusCard,
        // A frame, like the side menu (the Look's chrome), floating with the pop-up shadow.
        border: t.nx.chromeEdge,
        bgcolor: t.nx.chromeFill,
        backdropFilter: t.nxScheme.surfaces === "glass" ? "blur(14px)" : "none",
        boxShadow: t.nx.popupShadow,
        transition: "width .2s ease",
      })}
    >
      <Tooltip title={open ? "Fold the Dashboard Menu" : "Open the Dashboard Menu"} placement="left">
        <Button
          variant="outlined"
          aria-label={open ? "Fold the Dashboard Menu" : "Open the Dashboard Menu"}
          onClick={() => setOpen((o) => !o)}
          sx={{ minWidth: SIZE, width: SIZE, height: SIZE / 1.4, p: 0, alignSelf: open ? "flex-end" : "center", flexShrink: 0 }}
        >
          {open ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </Button>
      </Tooltip>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "var(--nx-list-gap)", minHeight: 0, overflowY: "auto", scrollbarWidth: "none" }}>
        {dashboards.map((d, i) => (
          <RoomTile key={d.id} d={d} active={d.id === activeId} onGo={() => onGo(d)} size={SIZE} label={open ? "beside" : "none"} arrange={arrange} index={i} count={dashboards.length} axis="column" />
        ))}
      </Box>
      <Box sx={{ height: "1px", bgcolor: "divider", my: 0.5, flexShrink: 0 }} />
      <Stack alignItems={open ? "flex-end" : "center"} sx={{ flexShrink: 0 }}>
        {tools(open ? "row" : "column", SIZE)}
      </Stack>
    </Box>
  );
}
