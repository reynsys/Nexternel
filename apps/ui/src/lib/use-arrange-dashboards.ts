import { useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { api, type DashboardSummary } from "../api";
import { announceLocalChange } from "./live-changes";

/** Marks a dashboard's place in a list being arranged (the grip finds the one under the finger by it). */
export const ARRANGE_ATTR = "data-nx-arrange-id";

export type ArrangeDashboards = {
  /** Arranging is possible now (editing, may edit, not a wall display). */
  enabled: boolean;
  /** The dashboard being dragged. */
  draggingId: string | null;
  /** Move one place back (-1) or forward (+1); saved at once. */
  move: (id: string, dir: -1 | 1) => void;
  /** What the grip of a dashboard needs: press and drag it over the others (mouse, pen or finger). */
  gripProps: (d: DashboardSummary) => {
    onPointerDown: (e: ReactPointerEvent) => void;
    onClick: (e: ReactMouseEvent) => void;
  };
};

/**
 * Arranging dashboards while editing — one way for every place dashboards are shown (tabs along the
 * top, the Dock, the Rail). The dragged dashboard moves into each place the pointer passes, so you
 * see the new order as you go; letting go keeps it (saved at once). Pointer events, not the
 * browser's own drag and drop, so it works the same with a finger on a touch screen.
 */
export function useArrangeDashboards({
  dashboards,
  setDashboards,
  enabled,
  onError,
}: {
  dashboards: DashboardSummary[];
  setDashboards: (list: DashboardSummary[]) => void;
  enabled: boolean;
  onError: (message: string | null) => void;
}): ArrangeDashboards {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const latest = useRef(dashboards);
  latest.current = dashboards;

  async function save(list: DashboardSummary[]) {
    onError(null);
    try {
      setDashboards((await api.reorderDashboards(list.map((d) => d.id))).dashboards);
      announceLocalChange("dashboards");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save the order");
    }
  }

  function show(list: DashboardSummary[]) {
    latest.current = list;
    setDashboards(list);
  }

  function move(id: string, dir: -1 | 1) {
    const list = [...latest.current];
    const i = list.findIndex((d) => d.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    show(list);
    void save(list);
  }

  function gripProps(d: DashboardSummary) {
    return {
      onPointerDown: (e: ReactPointerEvent) => {
        if (!enabled || e.button > 0) return;
        // The grip sits in the dashboard's button: pressing it never opens that dashboard.
        e.preventDefault();
        e.stopPropagation();
        const before = latest.current.map((x) => x.id).join();
        setDraggingId(d.id);
        const onMove = (ev: PointerEvent) => {
          const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(`[${ARRANGE_ATTR}]`)?.getAttribute(ARRANGE_ATTR);
          if (!over || over === d.id) return;
          const list = [...latest.current];
          const from = list.findIndex((x) => x.id === d.id);
          const to = list.findIndex((x) => x.id === over);
          if (from < 0 || to < 0) return;
          list.splice(to, 0, list.splice(from, 1)[0]!);
          show(list);
        };
        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          setDraggingId(null);
          if (latest.current.map((x) => x.id).join() !== before) void save(latest.current);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
      },
      onClick: (e: ReactMouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      },
    };
  }

  return { enabled, draggingId, move, gripProps };
}
