import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Box, Button, Portal, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/** Width of the side panel on wide screens; the page keeps this much free on the right. */
export const SIDE_PANEL_WIDTH = 440;

type Claim = { id: string; close: () => void };
type Ctx = { active: string | null; claim: (c: Claim) => void; release: (id: string) => void };

const SidePanelContext = createContext<Ctx | null>(null);

/**
 * One side panel at a time: opening one (Edit panel, Add panel, Dashboard settings, Section
 * settings) closes the one that was open, the way Close would.
 */
export function SidePanelProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  const current = useRef<Claim | null>(null);
  const claim = useCallback((c: Claim) => {
    const before = current.current;
    current.current = c;
    setActive(c.id);
    if (before && before.id !== c.id) before.close();
  }, []);
  const release = useCallback((id: string) => {
    if (current.current?.id !== id) return;
    current.current = null;
    setActive(null);
  }, []);
  const value = useMemo(() => ({ active, claim, release }), [active, claim, release]);
  return <SidePanelContext.Provider value={value}>{children}</SidePanelContext.Provider>;
}

/** True while any side panel is open (the page keeps room for it). */
export function useSidePanelOpen(): boolean {
  return useContext(SidePanelContext)?.active != null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** A second line under the title, e.g. which panel or section this is about. */
  subtitle?: ReactNode;
  /** Shown between the title and the scrolling body (e.g. a preview or page buttons). */
  top?: ReactNode;
  /** Buttons at the bottom (e.g. Cancel / Apply). Without it, the header's Close is the way out. */
  footer?: ReactNode;
  /** Close button in the header (default: shown when there is no footer). */
  showClose?: boolean;
  children: ReactNode;
};

/**
 * The side panel of the dashboard editor: attached to the right edge of the screen, the dashboard
 * moves over to keep it in view (nothing is covered or darkened), so changes show straight away.
 * On phones it fills the screen. It takes the Look's pop-up surface.
 */
export function SidePanel({ open, onClose, title, subtitle, top, footer, showClose, children }: Props) {
  const ctx = useContext(SidePanelContext);
  const id = useId();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down("md"));
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!ctx) return undefined;
    if (open) ctx.claim({ id, close: () => closeRef.current() });
    else ctx.release(id);
    return () => ctx.release(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  // The page keeps room on the right while a side panel is open (wide screens).
  const shown = open && (!ctx || ctx.active === id);
  useEffect(() => {
    if (!shown || narrow) return undefined;
    document.documentElement.style.setProperty("--nx-side-panel-width", `${SIDE_PANEL_WIDTH}px`);
    return () => {
      document.documentElement.style.removeProperty("--nx-side-panel-width");
    };
  }, [shown, narrow]);

  // Escape closes it, like Close.
  useEffect(() => {
    if (!shown) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown]);

  if (!shown) return null;
  // Drawn at the top level of the page, so no spacing or layout of the page can move it.
  return (
    <Portal>
    <Box
      role="complementary"
      aria-label={typeof title === "string" ? title : undefined}
      data-nx-role="popup"
      data-nx-side-panel=""
      sx={(t) => ({
        position: "fixed",
        zIndex: t.zIndex.drawer,
        top: 0,
        right: 0,
        bottom: 0,
        width: narrow ? "100%" : SIDE_PANEL_WIDTH,
        display: "flex",
        flexDirection: "column",
        bgcolor: t.nx.popupFill || "background.paper",
        borderLeft: t.nx.popupBorder || `1px solid ${t.palette.divider}`,
        boxShadow: t.nx.popupShadow || "0 0 40px rgba(0,0,0,.45)",
        backdropFilter: "blur(14px)",
      })}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ px: 2, pt: 2, pb: 1.5, flexShrink: 0, borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {(showClose ?? !footer) ? (
          <Button variant="outlined" onClick={onClose} sx={{ flexShrink: 0 }}>
            Close
          </Button>
        ) : null}
      </Stack>
      {top ? <Box sx={{ px: 2, pt: 1.5, flexShrink: 0 }}>{top}</Box> : null}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2, py: 2 }}>{children}</Box>
      {footer ? <Box sx={{ flexShrink: 0, px: 2, py: 1.5, borderTop: 1, borderColor: "divider" }}>{footer}</Box> : null}
    </Box>
    </Portal>
  );
}
