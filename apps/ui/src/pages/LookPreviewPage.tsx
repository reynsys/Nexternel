import { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { answerWithSamples, type HistoryRange } from "../api";
import { LookLayer } from "../skins/SkinProvider";
import { getSkin } from "../skins/registry";
import { normalizeThemePrefs, type ThemePrefs } from "../skins/themePrefs";
import { loadAddons } from "../skins/looks/addon-loader";
import { LookSample, NO_CONTROLS, SAMPLE_ENERGY, sampleCapability } from "../components/appearance/LookSample";
import { LOOK_PREVIEW_PREFS, LOOK_PREVIEW_READY, type LookPreviewMessage } from "../lib/look-preview-messages";

/**
 * The Appearance preview's own page (/look-preview), shown inside Settings → Appearance and
 * Users → Edit → Appearance: a dashboard section with the real panels (LookSample), in the settings
 * the page sends it, over their background with their background effect. A page of its own because
 * the preview shows the whole Appearance, background and effect included. (The Look and button style
 * tiles are drawn straight in the Appearance page, each in a Look box: LookLayer box.)
 */

/** Sample history for the charts and a sample forecast, so the preview asks the server nothing. */
const HOUR = 3600_000;
function samplePoints(range: string, cap: string): { t: string; v: number }[] {
  const end = Date.now();
  if (cap === SAMPLE_ENERGY || range === "7d")
    return [8.2, 11.4, 9.1, 12.8, 10.3, 7.6, 9.6].map((v, i) => ({ t: new Date(end - (6 - i) * 24 * HOUR).toISOString(), v }));
  return Array.from({ length: 25 }, (_, i) => {
    const h = i - 24;
    return { t: new Date(end + h * HOUR).toISOString(), v: Math.round((20 + 1.6 * Math.sin(((h + 9) / 24) * 2 * Math.PI) + 0.3 * Math.sin(i * 1.7)) * 10) / 10 };
  });
}
const nameOf = sampleCapability;
answerWithSamples((path) => {
  const url = new URL(path, window.location.origin);
  if (url.pathname === "/api/v1/history") {
    const range = (url.searchParams.get("range") ?? "24h") as HistoryRange;
    const one = url.searchParams.get("capabilityId");
    const ids = one ? [one] : (url.searchParams.get("capabilityIds") ?? "").split(",").filter(Boolean);
    const series = ids.map((id) => ({ capabilityId: id, name: nameOf(id)?.name ?? id, unit: nameOf(id)?.unit ?? null, aggregateEvery: range === "7d" ? "1d" : "1h", points: samplePoints(range, id) }));
    return one ? { ...series[0], range } : { range, series };
  }
  if (url.pathname === "/api/v1/weather") {
    const day = (d: number, code: number, description: string, max: number, min: number) => ({ date: new Date(Date.now() + d * 24 * HOUR).toISOString().slice(0, 10), weatherCode: code, description, tempMax: max, tempMin: min, precipProbability: code > 50 ? 60 : 5 });
    return {
      temperature: 14, humidity: 62, windSpeed: 11, weatherCode: 1, description: "Mainly clear", time: new Date().toISOString(), source: "sample",
      forecast: [day(0, 1, "Mainly clear", 15, 8), day(1, 3, "Cloudy", 13, 7), day(2, 61, "Light rain", 12, 6), day(3, 2, "Partly cloudy", 14, 7), day(4, 0, "Clear", 16, 8)],
    };
  }
  return undefined;
});

export function LookPreviewPage() {
  const [shown, setShown] = useState<{ prefs: ThemePrefs; skinId: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Settings come from the page this preview sits in (same address only).
  useEffect(() => {
    void loadAddons();
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const msg = e.data as LookPreviewMessage;
      if (msg?.type === LOOK_PREVIEW_PREFS) setShown({ prefs: normalizeThemePrefs(msg.prefs), skinId: msg.skinId });
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: LOOK_PREVIEW_READY } satisfies LookPreviewMessage, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // One shape for every Look (the frame's): the drawing is fitted inside it and centred, so a Look
  // with a taller frame is shrunk a little instead of making the preview taller.
  const [fit, setFit] = useState({ scale: 1, width: 0, height: 0 });
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      const scale = height > 0 ? Math.min(1, window.innerHeight / height) : 1;
      setFit((f) => (f.scale === scale && f.width === width && f.height === height ? f : { scale, width, height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [shown !== null]);

  const skin = useMemo(() => getSkin(shown?.skinId ?? ""), [shown?.skinId]);
  if (!shown) return <div ref={contentRef} />;

  return (
    <LookLayer skin={skin} themePrefs={shown.prefs} controls={NO_CONTROLS}>
      <Box sx={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <Box sx={{ width: fit.width * fit.scale || "100%", height: fit.height * fit.scale || "auto", flex: "none" }}>
          <Box ref={contentRef} sx={{ width: "100vw", transform: `scale(${fit.scale})`, transformOrigin: "top left" }}>
            <LookSample show="dashboard" />
          </Box>
        </Box>
      </Box>
    </LookLayer>
  );
}
