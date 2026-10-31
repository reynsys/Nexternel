import { useEffect, useMemo, useRef, useState } from "react";
import { GlobalStyles } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { paletteColours } from "../gradientPalettes";
import type { ThemePrefs } from "../themePrefs";
import type { EffectOptions, Rgb } from "./engine";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** True when this device asks for less motion — background effects then stay still. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.(REDUCED_MOTION).matches === true
  );
  useEffect(() => {
    const mq = window.matchMedia?.(REDUCED_MOTION);
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0) as Rgb;
}

/** How an effect is drawn for these Appearance choices: its colours, amount and speed. */
export function useEffectOptions(prefs: ThemePrefs): EffectOptions {
  const theme = useTheme();
  const effectId = prefs.effectId ?? "off";
  return useMemo<EffectOptions>(() => {
    const light = prefs.mode === "light";
    let colours: Rgb[] = light ? [[70, 85, 110]] : [[255, 255, 255]];
    if (prefs.effectColour === "accent") colours = [hexToRgb(theme.palette.primary.main)];
    if (prefs.effectColour === "scene") {
      const scene = paletteColours(prefs.gradientId);
      colours = scene.length ? scene : [hexToRgb(theme.palette.primary.main)];
    }
    return { id: effectId, amount: prefs.effectAmount ?? 1, speed: prefs.effectSpeed ?? 1, colours, light };
  }, [effectId, prefs.mode, prefs.effectColour, prefs.effectAmount, prefs.effectSpeed, prefs.gradientId, theme.palette.primary.main]);
}

/**
 * The animated background behind the whole app (Settings → Appearance → Background effect).
 * The drawing code downloads only when an effect is switched on.
 */
export function BackgroundEffects({ prefs }: { prefs: ThemePrefs }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runningRef = useRef<{ update: (o: EffectOptions) => void; stop: () => void } | null>(null);
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const effectId = prefs.effectId ?? "off";
  const active = effectId !== "off" && !reducedMotion;
  const options = useEffectOptions(prefs);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void import("./engine").then(({ startEffect }) => {
      if (cancelled || !canvasRef.current) return;
      runningRef.current = startEffect(canvasRef.current, optionsRef.current);
    });
    return () => {
      cancelled = true;
      runningRef.current?.stop();
      runningRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    runningRef.current?.update(options);
  }, [options]);

  if (!active) return null;
  return (
    <>
      {/* Glass without blur while the background moves — see surfaceStyles.ts. */}
      <GlobalStyles
        styles={{
          ":root": {
            "--nx-glass-blur": "none",
            "--nx-glass-tint": alpha(theme.palette.background.paper, prefs.mode === "light" ? 0.4 : 0.45),
          },
        }}
      />
      <canvas ref={canvasRef} aria-hidden="true" className="nx-page-layer" style={{ zIndex: -1 }} />
    </>
  );
}

/**
 * A small moving picture of one effect (the effect tiles in Settings → Appearance), drawn by the same
 * engine as the real background with the person's colours, amount and speed.
 */
export function EffectPicture({ options }: { options: EffectOptions }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runningRef = useRef<{ update: (o: EffectOptions) => void; stop: () => void } | null>(null);
  const reducedMotion = useReducedMotion();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const active = options.id !== "off" && !reducedMotion;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void import("./engine").then(({ startEffect }) => {
      if (cancelled || !canvasRef.current) return;
      runningRef.current = startEffect(canvasRef.current, optionsRef.current);
    });
    return () => {
      cancelled = true;
      runningRef.current?.stop();
      runningRef.current = null;
    };
  }, [active]);

  const key = JSON.stringify(options);
  useEffect(() => {
    runningRef.current?.update(optionsRef.current);
  }, [key]);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }} />;
}
