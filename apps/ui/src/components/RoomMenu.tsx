import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Box, Button, Tooltip, Typography, type Theme } from "@mui/material";
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
  tip,
  arrange,
  index,
  count,
  axis,
}: {
  d: DashboardSummary;
  active: boolean;
  onGo: () => void;
  size: number;
  /** Where the room's name shows when pointed at (towards the dashboard). */
  tip: "bottom" | "left";
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
      sx={{
        minWidth: size,
        height: size,
        px: 0,
        flexShrink: 0,
        justifyContent: "center",
        textTransform: "none",
        overflow: "visible",
        ...(dragging ? { opacity: 0.6, outline: "2px dashed", outlineColor: "primary.main", outlineOffset: 2 } : {}),
      }}
    >
      <ArrangeGrip d={d} arrange={arrange} corner />
      <Icon fontSize="small" />
    </Button>
  );
  const shown = (
    <Tooltip title={d.name} placement={tip}>
      {tile}
    </Tooltip>
  );
  if (!arrange.enabled) return shown;
  // While arranging: the grip finds this place by its mark; the open room has its arrows under it.
  return (
    <Box
      {...{ [ARRANGE_ATTR]: d.id }}
      sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--nx-control-gap)", flexShrink: 0 }}
    >
      {shown}
      {active ? <ArrangeArrows d={d} index={index} count={count} arrange={arrange} axis={axis} layout="row" size={20} /> : null}
    </Box>
  );
}

/** A floating island; the room under the pointer grows (like a Mac dock). */
const TILE = 46;
const GROW = 0.22; // the most a room grows; the dock keeps this much room beside its rooms
/** Space between the dock (or rail) and the edge of the screen (wide screens). */
const DOCK_GAP = 14;

/** The magnifying effect: rooms near the pointer grow, along the way the rooms run. */
function useMagnify(box: RefObject<HTMLDivElement | null>, axis: "row" | "column") {
  const frame = useRef(0);
  return (at: number | null) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      box.current?.querySelectorAll<HTMLElement>("[data-nx-room]").forEach((k) => {
        if (at === null) {
          k.style.transform = "";
          return;
        }
        const r = k.getBoundingClientRect();
        const mid = axis === "row" ? r.left + r.width / 2 : r.top + r.height / 2;
        const dx = Math.abs(at - mid) / (TILE * 2.2);
        const g = dx >= 1 ? 0 : GROW * (Math.cos(dx * Math.PI) + 1) / 2;
        k.style.transform = `scale(${(1 + g).toFixed(3)})`;
      });
    });
  };
}

/** The dock's frame: the Look's chrome, floating with the pop-up shadow. */
const islandFrame = (t: Theme) => ({
  borderRadius: t.nx.radiusCard,
  border: t.nx.chromeEdge,
  bgcolor: t.nx.chromeFill,
  backdropFilter: t.nxScheme.surfaces === "glass" ? "blur(14px)" : "none",
  boxShadow: t.nx.popupShadow,
});

/** Centred under the dashboard at the bottom of the screen. */
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
  const magnify = useMagnify(dock, "row");
  return (
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
        ...islandFrame(t),
        "& [data-nx-room]": { transition: "transform .18s cubic-bezier(.2,.7,.3,1)", transformOrigin: "bottom center", willChange: "transform" },
      })}
    >
      {loading ? <Typography variant="caption">Loading rooms…</Typography> : null}
      {error ? <Typography variant="caption" color="error">{error}</Typography> : null}
      {dashboards.map((d, i) => (
        <RoomTile key={d.id} d={d} active={d.id === activeId} onGo={() => onGo(d)} size={TILE} tip="bottom" arrange={arrange} index={i} count={dashboards.length} axis="row" />
      ))}
      <Box sx={{ width: "1px", alignSelf: "stretch", bgcolor: "divider", mx: 0.5, flexShrink: 0 }} />
      {tools("row", TILE)}
    </Box>
  );
}

/**
 * The dock standing up on the right, centred top to bottom: the same rooms, the same growing
 * under the pointer (towards the dashboard), names when pointed at; the bell and Dashboard
 * Options at the bottom. Rooms scroll inside when they no longer fit.
 */
function Rail({ dashboards, activeId, onGo, tools, loading, error, arrange }: Props) {
  const rail = useRef<HTMLDivElement>(null);
  // The page keeps the rail's width plus its gap free on the right.
  useEffect(() => {
    const el = rail.current;
    if (!el) return undefined;
    const set = () => document.documentElement.style.setProperty("--nx-rail-width", `${Math.ceil(el.offsetWidth) + DOCK_GAP}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--nx-rail-width");
    };
  }, []);
  const magnify = useMagnify(rail, "column");
  const grow = Math.ceil(TILE * GROW);
  return (
    <Box
      ref={rail}
      data-nx-room-menu="rail"
      onMouseMove={(e) => magnify(e.clientY)}
      onMouseLeave={() => magnify(null)}
      sx={(t) => ({
        position: "fixed",
        zIndex: t.zIndex.appBar,
        top: "50%",
        right: DOCK_GAP,
        transform: "translateY(-50%)",
        maxHeight: `calc(100vh - ${DOCK_GAP * 2}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "calc(var(--nx-control-gap) + 2px)",
        py: 2,
        pr: "10px",
        ...islandFrame(t),
        "& [data-nx-room]": { transition: "transform .18s cubic-bezier(.2,.7,.3,1)", transformOrigin: "right center", willChange: "transform" },
      })}
    >
      {loading ? <Typography variant="caption">Loading…</Typography> : null}
      {error ? <Typography variant="caption" color="error">{error}</Typography> : null}
      {/* Room on the left (and a little above and below) so a growing room stays inside the rail. */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "calc(var(--nx-control-gap) + 2px)",
          minHeight: 0,
          overflowY: "auto",
          scrollbarWidth: "none",
          pl: `${grow + 10}px`,
          py: `${Math.ceil(grow / 2)}px`,
          my: `-${Math.ceil(grow / 2)}px`,
        }}
      >
        {dashboards.map((d, i) => (
          <RoomTile key={d.id} d={d} active={d.id === activeId} onGo={() => onGo(d)} size={TILE} tip="left" arrange={arrange} index={i} count={dashboards.length} axis="column" />
        ))}
      </Box>
      <Box sx={{ height: "1px", alignSelf: "stretch", ml: `${grow + 10}px`, bgcolor: "divider", my: 0.5, flexShrink: 0 }} />
      {tools("column", TILE)}
    </Box>
  );
}
