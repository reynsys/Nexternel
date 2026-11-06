import { Box } from "@mui/material";
import { useRef, useState, type PointerEvent } from "react";
import { clampToStep, dialShare, shareFromPoint, splitTemperature } from "./control-view";
import { CONTROL_TEXT, CONTROL_VALUE_WEIGHT } from "../../lib/appearance/type";
import { CTRL } from "./control-style";

const TICKS = 61;
const CENTRE = 120;

function at(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [CENTRE + r * Math.cos(a), CENTRE + r * Math.sin(a)];
}
const angleOf = (share: number) => 135 + share * 270;
const MARKS = Array.from({ length: TICKS }, (_, i) => {
  const d = angleOf(i / (TICKS - 1));
  const [x1, y1] = at(d, 96);
  const [x2, y2] = at(d, 109);
  return { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1) };
});

type Props = {
  value: number | undefined;
  current: number | undefined;
  min: number;
  max: number;
  step: number;
  enabled: boolean;
  /** Shown instead of the number when there is no temperature to set (Fan). */
  word?: string;
  onCommit: (value: number) => void;
};

/**
 * The set temperature on a ring of marks: drag it, and it is sent on letting go. The whole degrees
 * never move when .5 comes and goes, and the white dot shows the temperature it is now.
 */
export function TemperatureDial({ value, current, min, max, step, enabled, word, onCommit }: Props) {
  const [drag, setDrag] = useState<number | null>(null);
  const dragging = useRef<number | null>(null);
  const shown = drag ?? value;
  const share = shown === undefined || word ? 0 : dialShare(shown, min, max);
  const lit = shown === undefined || word ? -1 : Math.round(share * (TICKS - 1));
  const [hx, hy] = at(angleOf(share), 102.5);
  const parts = shown === undefined ? null : splitTemperature(shown);

  function move(e: PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const s = shareFromPoint(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    const v = clampToStep(min + s * (max - min), min, max, step);
    dragging.current = v;
    setDrag(v);
  }

  const dot = current === undefined ? null : at(angleOf(dialShare(current, min, max)), 117);
  const canDrag = enabled && !word;
  return (
    <Box
      aria-hidden
      onPointerDown={(e: PointerEvent<HTMLElement>) => {
        if (!canDrag) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e: PointerEvent<HTMLElement>) => {
        if (dragging.current !== null) move(e);
      }}
      onPointerUp={() => {
        if (dragging.current !== null) onCommit(dragging.current);
        dragging.current = null;
        setDrag(null);
      }}
      onPointerCancel={() => {
        dragging.current = null;
        setDrag(null);
      }}
      sx={{ position: "relative", width: "min(100cqi, 100cqb)", height: "min(100cqi, 100cqb)", touchAction: "none", cursor: canDrag ? "grab" : "default" }}
    >
      <svg viewBox="0 0 240 240" style={{ display: "block", width: "100%", height: "100%" }}>
        <g stroke={CTRL.track} strokeWidth={3} strokeLinecap="round">
          {MARKS.map((m, i) => <line key={i} {...m} />)}
        </g>
        <g stroke="var(--c)" strokeWidth={3.4} strokeLinecap="round" style={{ filter: "drop-shadow(0 0 5px var(--c))" }}>
          {MARKS.slice(0, lit + 1).map((m, i) => <line key={i} {...m} />)}
        </g>
        {dot ? <circle cx={dot[0]} cy={dot[1]} r={3.5} fill="currentColor" /> : null}
        {lit >= 0 ? <circle cx={hx} cy={hy} r={9} fill="var(--nx-ctrl-hole)" stroke="var(--c)" strokeWidth={4} /> : null}
      </svg>
      <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1cqmin", pointerEvents: "none", textAlign: "center" }}>
        <Box sx={CTRL.caption}>Set to</Box>
        {word || !parts ? (
          <Box sx={{ ...CTRL.big, fontSize: CONTROL_TEXT.picture }}>{word ?? "—"}</Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", width: "100%", fontSize: CONTROL_TEXT.dial, fontWeight: CONTROL_VALUE_WEIGHT, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ gridColumn: 2 }}>{parts.whole}</span>
            <Box component="span" sx={{ gridColumn: 3, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-start", pl: "1cqmin", py: "1.5cqmin", fontSize: CONTROL_TEXT.dialSide, fontWeight: "fontWeightMedium", lineHeight: 1 }}>
              <span>°</span>
              <span>{parts.half}</span>
            </Box>
          </Box>
        )}
        {current !== undefined ? (
          <Box sx={{ ...CTRL.caption, display: "flex", gap: "0.3em", justifyContent: "center", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
            <span>Currently</span>
            {/* A fixed width, so the line stays still when .5 comes and goes. */}
            <Box component="b" sx={{ width: "2.9em", textAlign: "left", color: "text.primary", fontWeight: "fontWeightBold" }}>{current}°</Box>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
