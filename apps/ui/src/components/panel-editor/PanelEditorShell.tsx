import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Box, Button, Stack, Tab, Tabs, Typography } from "@mui/material";
import type { CameraRecord, Capability } from "../../api";
import type { RuntimePanelInstance } from "../../lib/panel-compatibility/types";
import { PanelCard } from "../PanelCard";
import { ButtonRow } from "../ButtonRow";
import { SidePanel } from "../side-panel/SidePanel";

export type PanelEditorTabId = "content" | "look" | "light";

export type PanelEditorTab = {
  id: PanelEditorTabId;
  label: string;
  /** null = this panel has nothing for this tab, so the tab is not shown. */
  content: ReactNode | null;
};

type ShellProps = {
  open: boolean;
  /** "Edit Hallway Monitor" */
  title: string;
  /** "Status panel" */
  kindLabel?: string;
  preview?: ReactNode;
  tabs: PanelEditorTab[];
  onCancel: () => void;
  onApply: () => void;
  applyDisabled?: boolean;
  /** Shown above the buttons, e.g. a problem with the settings. */
  footerNote?: ReactNode;
};

/**
 * The Edit menu of every dashboard panel: a live preview at the top, then the tabs Content, Look
 * and Status light (only those the panel has something for), then Cancel / Apply.
 */
export function PanelEditorShell({
  open,
  title,
  kindLabel,
  preview,
  tabs,
  onCancel,
  onApply,
  applyDisabled,
  footerNote,
}: ShellProps) {
  const shown = tabs.filter((t) => t.content !== null && t.content !== undefined && t.content !== false);
  const [tab, setTab] = useState<PanelEditorTabId>(shown[0]?.id ?? "look");
  useEffect(() => {
    if (open) setTab(shown[0]?.id ?? "look");
    // Start on the first tab each time the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const current = shown.find((t) => t.id === tab) ?? shown[0];

  return (
    <SidePanel
      open={open}
      onClose={onCancel}
      title={title}
      subtitle={kindLabel}
      top={
        <>
          {preview ? (
            <Box sx={{ pb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Preview
              </Typography>
              {preview}
            </Box>
          ) : null}
          {shown.length > 1 ? (
            <Tabs
              value={current?.id ?? false}
              onChange={(_, v: PanelEditorTabId) => setTab(v)}
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: "divider", minHeight: 40, "& .MuiTab-root": { minHeight: 40 } }}
            >
              {shown.map((t) => (
                <Tab key={t.id} value={t.id} label={t.label} sx={{ textTransform: "none" }} />
              ))}
            </Tabs>
          ) : null}
        </>
      }
      footer={
        <>
          {footerNote}
          <ButtonRow direction="row" sx={{ mt: footerNote ? 1 : 0 }}>
            <Button variant="outlined" onClick={onCancel} fullWidth>
              Cancel
            </Button>
            <Button variant="contained" onClick={onApply} fullWidth disabled={applyDisabled}>
              Apply
            </Button>
          </ButtonRow>
        </>
      }
    >
      <Stack spacing={2}>{current?.content}</Stack>
    </SidePanel>
  );
}

const PREVIEW_MAX_HEIGHT = 240;

/**
 * The panel as the dashboard draws it, at its real size on the dashboard, shrunk to fit the menu.
 * It only shows: clicks inside it do nothing (a switch in the preview must not switch the device).
 */
export function PanelPreview({
  panel,
  size,
  capabilities,
  cameras,
  sectionRoomId,
}: {
  panel: RuntimePanelInstance;
  /** The panel's size on the dashboard, in pixels. */
  size: { width: number; height: number };
  capabilities: Capability[];
  cameras?: CameraRecord[];
  sectionRoomId?: string | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(440);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setAvail(Math.max(120, Math.floor(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const width = Math.max(120, size.width);
  const height = Math.max(80, size.height);
  const scale = Math.min(1, avail / width, PREVIEW_MAX_HEIGHT / height);

  return (
    <Box ref={boxRef} sx={{ width: "100%" }}>
      <Box
        aria-label="Preview of the panel"
        role="img"
        sx={{ width: width * scale, height: height * scale, mx: "auto", overflow: "hidden", pointerEvents: "none" }}
      >
        <Box sx={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left", display: "flex" }}>
          <PanelCard panel={panel} capabilities={capabilities} cameras={cameras} sectionRoomId={sectionRoomId} />
        </Box>
      </Box>
    </Box>
  );
}
