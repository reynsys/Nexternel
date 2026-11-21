import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import type { ThemePrefs } from "../../skins/themePrefs";
import {
  LOOK_PREVIEW_HEIGHT,
  LOOK_PREVIEW_PATH,
  LOOK_PREVIEW_PREFS,
  LOOK_PREVIEW_READY,
  type LookPreviewMessage,
  type LookPreviewShow,
} from "../../lib/look-preview-messages";

/**
 * Real parts drawn in some Appearance settings (not necessarily the ones in use): a page of its own
 * (pages/LookPreviewPage.tsx) in a frame, because every Look and button style styles the whole page it
 * is on. Drawn `drawnWidth` wide, then shrunk to fit. Nothing in it can be pressed.
 */
export function LookFrame({
  prefs,
  skinId,
  show,
  drawnWidth,
  startHeight = 200,
  title,
}: {
  prefs: ThemePrefs;
  skinId: string;
  show: LookPreviewShow;
  drawnWidth: number;
  startHeight?: number;
  /** What it shows, for screen readers. */
  title: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(drawnWidth);
  const [height, setHeight] = useState(startHeight);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setAvail(Math.max(60, Math.floor(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const send = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: LOOK_PREVIEW_PREFS, prefs, skinId } satisfies LookPreviewMessage, window.location.origin);
  }, [prefs, skinId]);

  // The page says when it is ready and how tall it is.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const msg = e.data as LookPreviewMessage;
      if (msg?.type === LOOK_PREVIEW_READY) setReady(true);
      else if (msg?.type === LOOK_PREVIEW_HEIGHT && msg.height > 0) setHeight(msg.height);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Every change is sent as it is made.
  useEffect(() => {
    if (ready) send();
  }, [ready, send]);

  const scale = Math.min(1, avail / drawnWidth);
  return (
    <Box ref={boxRef} sx={{ width: "100%", height: height * scale, overflow: "hidden" }}>
      <Box
        component="iframe"
        ref={frameRef}
        src={`${LOOK_PREVIEW_PATH}?show=${show}`}
        title={title}
        tabIndex={-1}
        sx={{ display: "block", border: 0, width: drawnWidth, height, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}
      />
    </Box>
  );
}
