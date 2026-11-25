import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { ThemePrefs } from "../../skins/themePrefs";
import { resolveLook } from "../../skins/looks/registry";
import { schemeForPrefs } from "../../skins/appearance-scheme";
import { LookLayer } from "../../skins/SkinProvider";
import { getSkin } from "../../skins/registry";
import { EffectPicture, useEffectOptions, useReducedMotion } from "../../skins/effects/BackgroundEffects";
import { LookSample, NO_CONTROLS } from "./LookSample";
import { ReadableLine } from "./ReadableLine";

/**
 * The preview is drawn as wide as a laptop's dashboard (five panels in a row), in one shape for every
 * Look (a Look with a taller frame is fitted inside, so the preview never changes size), then shrunk to fit.
 */
const DRAWN_WIDTH = 1160;
const DRAWN_HEIGHT = 880;

/** The background effect of these settings, moving behind the preview's panels (inside its Look box). */
function PreviewEffect({ prefs }: { prefs: ThemePrefs }) {
  const options = useEffectOptions(prefs);
  const reduced = useReducedMotion();
  if (options.id === "off" || reduced) return null;
  return (
    <Box aria-hidden sx={{ position: "absolute", inset: 0 }}>
      <EffectPicture options={options} full />
    </Box>
  );
}

/** Glass is drawn without blur while the background moves (as on the page: see BackgroundEffects). */
function useGlassOverEffect(prefs: ThemePrefs): Record<string, string> {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const moving = (prefs.effectId ?? "off") !== "off" && !reduced;
  return moving ? { "--nx-glass-blur": "none", "--nx-glass-tint": alpha(theme.palette.background.paper, prefs.mode === "light" ? 0.4 : 0.45) } : {};
}

/** Inside the Look box: background effect, then the panels fitted into the preview's shape and centred. */
function PreviewInside({ prefs, width, height }: { prefs: ThemePrefs; width: number; height: number }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const glass = useGlassOverEffect(prefs);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return undefined;
    const measure = () => setContentHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = contentHeight > 0 ? Math.min(1, height / contentHeight) : 1;
  return (
    <Box sx={{ position: "relative", height: "100%", overflow: "hidden", ...glass }}>
      <PreviewEffect prefs={prefs} />
      <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ width: width * fit, height: contentHeight * fit || "auto", flex: "none" }}>
          <Box ref={contentRef} sx={{ width, transform: `scale(${fit})`, transformOrigin: "top left" }}>
            <LookSample show="dashboard" />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** The page's own text size (its base size), to show the chosen one in proportion. */
function pageTextScale(): number {
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(px) && px > 0 ? px / 16 : 1;
}

/**
 * The settings being chosen (not necessarily the ones in use, e.g. when an admin sets a wall screen's
 * look), drawn straight in the page as a real dashboard section with real panels and sample readings,
 * over their background with their background effect, in a Look box of its own (LookLayer box): no
 * second copy of Nexternel is started for it. Under it: whether every text is readable.
 */
export function AppearancePreview({ prefs, skinId, deviceDark = true }: { prefs: ThemePrefs; skinId: string; deviceDark?: boolean }) {
  const look = resolveLook(prefs.lookId);
  const mode = look.forceMode ?? (prefs.autoMode ? (deviceDark ? "dark" : "light") : prefs.mode);
  const scheme = useMemo(() => schemeForPrefs({ ...prefs, mode }, mode, Boolean(look.frosted)), [prefs, mode, look]);
  const skin = useMemo(() => getSkin(skinId), [skinId]);

  const outerRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(DRAWN_WIDTH);
  const [pageText, setPageText] = useState(1);
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return undefined;
    const measure = () => {
      setAvail(Math.max(60, el.offsetWidth));
      setPageText(pageTextScale());
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The chosen text size: the page's text is measured in rem (the page's size), so the drawing is laid
  // out smaller by the same amount and shown larger, as on a screen with that text size.
  const text = (prefs.textSize ?? 100) / 100 / pageText;
  const width = DRAWN_WIDTH / text;
  const height = DRAWN_HEIGHT / text;
  const scale = Math.min(1, avail / DRAWN_WIDTH);

  return (
    <Box>
      <Box
        ref={outerRef}
        role="img"
        aria-label="Preview of these settings"
        sx={(t) => ({ borderRadius: 2, overflow: "hidden", border: `1px solid ${t.nxScheme.line.edge}`, height: DRAWN_HEIGHT * scale })}
      >
        <Box sx={{ width, height, transform: `scale(${scale * text})`, transformOrigin: "top left", pointerEvents: "none" }}>
          <LookLayer box skin={skin} themePrefs={prefs} controls={NO_CONTROLS}>
            <PreviewInside prefs={prefs} width={width} height={height} />
          </LookLayer>
        </Box>
      </Box>
      <ReadableLine scheme={scheme} />
    </Box>
  );
}
