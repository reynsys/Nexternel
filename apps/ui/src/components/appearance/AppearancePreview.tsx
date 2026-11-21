import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import type { ThemePrefs } from "../../skins/themePrefs";
import { resolveLook } from "../../skins/looks/registry";
import { schemeForPrefs } from "../../skins/appearance-scheme";
import {
  LOOK_PREVIEW_HEIGHT,
  LOOK_PREVIEW_PATH,
  LOOK_PREVIEW_PREFS,
  LOOK_PREVIEW_READY,
  type LookPreviewMessage,
} from "../../lib/look-preview-messages";

/** The preview is drawn as wide as a computer's dashboard, then shrunk to fit. */
const DRAWN_WIDTH = 760;
const START_HEIGHT = 420;

/**
 * The settings being chosen (not necessarily the ones in use, e.g. when an admin sets a wall screen's
 * look), drawn as a real dashboard section with real panels and sample readings. It is a page of its
 * own (pages/LookPreviewPage.tsx) because every Look styles the whole page it is on. Nothing in it
 * can be pressed. Under it: whether every text is readable.
 */
export function AppearancePreview({ prefs, skinId, deviceDark = true }: { prefs: ThemePrefs; skinId: string; deviceDark?: boolean }) {
  const look = resolveLook(prefs.lookId);
  const mode = look.forceMode ?? (prefs.autoMode ? (deviceDark ? "dark" : "light") : prefs.mode);
  const scheme = useMemo(() => schemeForPrefs({ ...prefs, mode }, mode, Boolean(look.frosted)), [prefs, mode, look]);
  const allReadable = scheme.audit.every((a) => a.pass);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(DRAWN_WIDTH);
  const [height, setHeight] = useState(START_HEIGHT);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setAvail(Math.max(160, Math.floor(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const send = useCallback(() => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: LOOK_PREVIEW_PREFS, prefs, skinId } satisfies LookPreviewMessage, window.location.origin);
  }, [prefs, skinId]);

  // The preview says when it is ready and how tall it is.
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

  const scale = Math.min(1, avail / DRAWN_WIDTH);

  return (
    <Box>
      <Box ref={boxRef} sx={(t) => ({ width: "100%", height: height * scale, overflow: "hidden", borderRadius: 2, border: `1px solid ${t.nxScheme.line.edge}` })}>
        <Box
          component="iframe"
          ref={frameRef}
          src={LOOK_PREVIEW_PATH}
          title="Preview of these settings"
          tabIndex={-1}
          sx={{ display: "block", border: 0, width: DRAWN_WIDTH, height, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}
        />
      </Box>
      <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: allReadable ? "success.main" : "warning.main" }}>
        {allReadable
          ? `✓ Every text and control is readable (${scheme.audit.length} checks).`
          : "Some text may be hard to read with these settings."}
      </Typography>
    </Box>
  );
}
