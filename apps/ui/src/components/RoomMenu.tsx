import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Box, Button, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { DashboardSummary } from "../api";
import { getDashboardIcon } from "../lib/dashboard-icons";
import type { RoomNav } from "../lib/room-nav";
import { LookDecor } from "../skins/looks/LookDecor";
import { BOTTOM_NAV_HEIGHT_PX } from "../skins/builtin/mui-dashboard/BottomNav";

type Props = {
  variant: Exclude<RoomNav, "tabs">;
  dashboards: DashboardSummary[];
  activeId?: string;
  loading: boolean;
  error: string | null;
  onGo: (d: DashboardSummary) => void;
  tools: (dir: "row" | "column") => ReactNode;
};

/** Room width the rail takes when open / folded (the page keeps this much free on the right). */
export const RAIL_OPEN = 200;
export const RAIL_FOLDED = 60;
const RAIL_KEY = "nx-rail-open";

/**
 * The room menu as a dock, a right rail or a rooms panel (the top tabs are DashboardTabBar).
 * Every room is a button: the open one filled, like everywhere else.
 */
export function RoomMenu(props: Props) {
  if (props.variant === "dock") return <Dock {...props} />;
  if (props.variant === "rail") return <Rail {...props} />;
  return <RoomsPanel {...props} />;
}

function RoomTile({ d, active, onGo, size, label }: { d: DashboardSummary; active: boolean; onGo: () => void; size: number; label: "beside" | "none" }) {
  const Icon = getDashboardIcon(d.tabIcon);
  // A real button, so every Look draws rooms like its other buttons (the open room filled).
  const tile = (
    <Button
      onClick={onGo}
      aria-label={d.name}
      aria-current={active ? "page" : undefined}
      data-nx-room=""
      data-nx-active-tab={active ? "" : undefined}
      variant={active ? "contained" : "outlined"}
      startIcon={label === "beside" ? <Icon fontSize="small" /> : undefined}
      sx={{
        minWidth: size,
        height: size,
        px: label === "beside" ? 1.25 : 0,
        flexShrink: 0,
        justifyContent: label === "beside" ? "flex-start" : "center",
        textTransform: "none",
        transition: "transform .12s ease",
        transformOrigin: "bottom center",
      }}
    >
      {label === "beside" ? (
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {d.name}
        </Box>
      ) : (
        <Icon fontSize="small" />
      )}
    </Button>
  );
  return label === "beside" ? tile : <Tooltip title={d.name}>{tile}</Tooltip>;
}

/** A floating island centred under the dashboard; the room under the pointer grows (like a Mac dock). */
function Dock({ dashboards, activeId, onGo, tools, loading, error }: Props) {
  const anchor = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const [centre, setCentre] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = anchor.current?.parentElement;
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
  const magnify = (x: number | null) => {
    dock.current?.querySelectorAll<HTMLElement>("[data-nx-room]").forEach((k) => {
      if (x === null) {
        k.style.transform = "";
        return;
      }
      const r = k.getBoundingClientRect();
      const dx = Math.abs(x - (r.left + r.width / 2));
      k.style.transform = `scale(${(1 + Math.max(0, 0.35 - dx / 260)).toFixed(3)})`;
    });
  };
  return (
    <>
      <Box ref={anchor} sx={{ height: 0, m: "0 !important" }} />
      {/* Room at the end of the page so the dock never covers the last panel. */}
      <Box
        ref={dock}
        data-nx-room-menu="dock"
        data-nx-role="popup"
        onMouseMove={(e) => magnify(e.clientX)}
        onMouseLeave={() => magnify(null)}
        sx={(t) => ({
          position: "fixed",
          zIndex: t.zIndex.appBar,
          // On phones it sits just above the phone's own menu bar.
          bottom: { xs: `calc(${BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom) + 8px)`, md: 14 },
          left: { xs: 8, md: centre === null ? "50%" : `${centre}px` },
          right: { xs: 8, md: "auto" },
          transform: { xs: "none", md: "translateX(-50%)" },
          maxWidth: { xs: "none", md: "calc(100vw - 32px)" },
          display: "flex",
          alignItems: "center",
          gap: "var(--nx-control-gap)",
          px: 1.5,
          py: 1,
          overflowX: "auto",
          scrollbarWidth: "none",
          borderRadius: t.nx.radiusCard,
          border: `1px solid ${t.palette.divider}`,
          bgcolor: "background.paper",
          backdropFilter: "blur(14px)",
          boxShadow: "0 8px 30px rgba(0,0,0,.35)",
        })}
      >
        {loading ? <Typography variant="caption">Loading rooms…</Typography> : null}
        {error ? <Typography variant="caption" color="error">{error}</Typography> : null}
        {dashboards.map((d) => (
          <RoomTile key={d.id} d={d} active={d.id === activeId} onGo={() => onGo(d)} size={44} label="none" />
        ))}
        <Box sx={{ width: "1px", alignSelf: "stretch", bgcolor: "divider", mx: 0.5, flexShrink: 0 }} />
        {tools("row")}
      </Box>
      <Box sx={{ height: { xs: 80, md: 72 }, m: "0 !important", order: 99 }} />
    </>
  );
}

/** A column on the right of the screen with all rooms; folds to icons. */
function Rail({ dashboards, activeId, onGo, tools }: Props) {
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
    document.documentElement.style.setProperty("--nx-rail-width", `${width}px`);
    return () => {
      document.documentElement.style.removeProperty("--nx-rail-width");
    };
  }, [open, width]);
  return (
    <Box
      data-nx-room-menu="rail"
      data-nx-role="chrome"
      sx={(t) => ({
        position: "fixed",
        zIndex: t.zIndex.appBar,
        top: 0,
        right: 0,
        bottom: 0,
        width,
        display: "flex",
        flexDirection: "column",
        gap: "var(--nx-list-gap)",
        p: 1,
        pt: 1.5,
        borderLeft: `1px solid ${t.palette.divider}`,
        bgcolor: "background.paper",
        overflowY: "auto",
        transition: "width .2s ease",
      })}
    >
      <Stack direction={open ? "row" : "column"} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <IconButton size="small" aria-label={open ? "Fold the room menu" : "Open the room menu"} onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
        {tools(open ? "row" : "column")}
      </Stack>
      {dashboards.map((d) => (
        <RoomTile key={d.id} d={d} active={d.id === activeId} onGo={() => onGo(d)} size={42} label={open ? "beside" : "none"} />
      ))}
    </Box>
  );
}

/** A panel beside the dashboard listing every room, in the same place on every dashboard. */
function RoomsPanel({ dashboards, activeId, onGo, tools }: Props) {
  return (
    <Box
      data-nx-room-menu="panel"
      data-nx-role="card"
      sx={(t) => ({
        position: "sticky",
        top: 16,
        alignSelf: "start",
        p: 1.5,
        borderRadius: t.nx.radiusCard,
        border: t.nx.panelBorder,
        bgcolor: "background.paper",
        overflow: "hidden",
      })}
    >
      <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <LookDecor slot="panel" />
      </Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, position: "relative" }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Rooms
        </Typography>
        {tools("row")}
      </Stack>
      <Stack sx={{ gap: "var(--nx-list-gap)", position: "relative" }}>
        {dashboards.map((d) => (
          <RoomTile key={d.id} d={d} active={d.id === activeId} onGo={() => onGo(d)} size={40} label="beside" />
        ))}
      </Stack>
    </Box>
  );
}
