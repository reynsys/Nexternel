import { Box } from "@mui/material";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { colorFromPoint } from "./control-view";

/** The real colours of light, the same under every Look. */
const SPECTRUM = "conic-gradient(hsl(0 100% 58%), hsl(60 100% 55%), hsl(120 90% 50%), hsl(180 100% 48%), hsl(240 100% 62%), hsl(300 100% 58%), hsl(360 100% 58%))";
const HOLE = "radial-gradient(closest-side, transparent 76%, #000 77%)";

type Props = {
  /** Round the ring; none while the lamp is white. */
  hue: number | undefined;
  disabled?: boolean;
  /** How strongly the middle glows, 0 to 1. */
  glow: number;
  onChange: (hue: number) => void;
  onCommit: (hue: number) => void;
  children?: ReactNode;
};

/** The colour ring: round the ring is the colour, the lamp's glow sits in the middle. */
export function ColourWheel({ hue, disabled, glow, onChange, onCommit, children }: Props) {
  const dragging = useRef(false);
  const last = useRef<number | undefined>(hue);

  function pick(e: PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const { h } = colorFromPoint(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    last.current = h;
    onChange(h);
  }

  const a = (((hue ?? 0) - 90) * Math.PI) / 180;
  return (
    <Box
      onPointerDown={(e: PointerEvent<HTMLElement>) => {
        if (disabled) return;
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e: PointerEvent<HTMLElement>) => {
        if (dragging.current) pick(e);
      }}
      onPointerUp={() => {
        if (dragging.current && last.current !== undefined) onCommit(last.current);
        dragging.current = false;
      }}
      sx={{ position: "relative", width: "min(94cqi, 94cqb)", height: "min(94cqi, 94cqb)", touchAction: "none", cursor: disabled ? "default" : "grab" }}
    >
      <Box aria-hidden sx={{ position: "absolute", inset: 0, borderRadius: "50%", background: SPECTRUM, WebkitMask: HOLE, mask: HOLE }} />
      <Box aria-hidden sx={{ position: "absolute", inset: "22%", borderRadius: "50%", background: "radial-gradient(closest-side, var(--c), transparent)", opacity: 0.15 + glow * 0.85, pointerEvents: "none" }} />
      {hue !== undefined ? (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            left: `${50 + 44.3 * Math.cos(a)}%`,
            top: `${50 + 44.3 * Math.sin(a)}%`,
            width: 32,
            height: 32,
            ml: "-16px",
            mt: "-16px",
            borderRadius: "50%",
            bgcolor: "var(--c)",
            border: "4px solid var(--nx-ctrl-hole)",
            boxShadow: "0 0 0 2px currentColor",
            pointerEvents: "none",
          }}
        />
      ) : null}
      <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", pointerEvents: "none" }}>
        {children}
      </Box>
    </Box>
  );
}
