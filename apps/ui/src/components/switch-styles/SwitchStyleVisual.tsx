import { useId, type CSSProperties } from "react";
import type { SwitchStyleId } from "../../lib/switch-styles";
import "./switch-styles.css";

/** Each style's size in em at full size (its font size shrinks so it fits the tile). */
const FOOTPRINT: Partial<Record<SwitchStyleId, [number, number]>> = {
  power: [5.5, 5.5],
  rocker: [4.125, 6.5],
  pair: [9, 2.6],
  lever: [3.125, 6.5],
  daynight: [7.75, 3.125],
  cyber: [4.625, 7.5],
  neon: [7, 3.875],
  gears: [8.75, 3.5],
  led: [8.75, 2.875],
  bigknob: [7, 2.875],
};

/*
 * Gears share one tooth size (module m), so they mesh: radius = teeth × m / 2.
 * The big gears' centres are 84 apart in a 140 × 56 well, the small one between:
 * 42 = (14 + 8) × m / 2.
 */
function gearPath(cx: number, cy: number, teeth: number, m: number, phase: number, holes: number): string {
  const r = (teeth * m) / 2;
  const ro = r + m;
  const rr = r - 1.25 * m;
  const step = (Math.PI * 2) / teeth;
  const pt = (a: number, rad: number, first = false) =>
    `${first ? "M" : "L"}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)} `;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = (i + phase) * step;
    d += pt(a - step * 0.32, rr, i === 0) + pt(a - step * 0.17, ro) + pt(a + step * 0.17, ro) + pt(a + step * 0.32, rr);
  }
  d += "Z ";
  const circle = (x: number, y: number, c: number) =>
    `M${(x + c).toFixed(2)} ${y.toFixed(2)} A${c.toFixed(2)} ${c.toFixed(2)} 0 1 0 ${(x - c).toFixed(2)} ${y.toFixed(2)} A${c.toFixed(2)} ${c.toFixed(2)} 0 1 0 ${(x + c).toFixed(2)} ${y.toFixed(2)} Z `;
  d += circle(cx, cy, Math.max(2, r * 0.16));
  for (let h = 0; h < holes; h++) {
    const ha = (h * Math.PI * 2) / holes + Math.PI / holes;
    d += circle(cx + r * 0.55 * Math.cos(ha), cy + r * 0.55 * Math.sin(ha), r * 0.17);
  }
  return d;
}

const MODULE = 84 / 22;
const GEAR_LEFT = gearPath(28, 28, 14, MODULE, 0, 5);
const GEAR_MIDDLE = gearPath(70, 28, 8, MODULE, 0.5, 0);
const GEAR_RIGHT = gearPath(112, 28, 14, MODULE, 0, 5);

function Gears() {
  // A Look pack can make the gears metal with: --gear-fill: var(--nxs-metal).
  const metal = `nxs-metal-${useId().replace(/:/g, "")}`;
  return (
    <span className="nxs-gr" style={{ "--nxs-metal": `url(#${metal})` } as CSSProperties}>
      <svg viewBox="0 0 140 56">
        <defs>
          <radialGradient id={metal} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#5b6372" />
            <stop offset=".35" stopColor="#cfd5df" />
            <stop offset=".55" stopColor="#9aa3b2" />
            <stop offset=".8" stopColor="#e3e8ef" />
            <stop offset="1" stopColor="#7d8697" />
          </radialGradient>
        </defs>
        <g className="gw"><path className="gear g1" d={GEAR_LEFT} /></g>
        <g className="gw"><path className="gear g3" d={GEAR_RIGHT} /></g>
        <g className="gw"><path className="gear g2" d={GEAR_MIDDLE} /></g>
        <rect className="rail" x="28" y="25" width="84" height="6" rx="3" />
      </svg>
      <span className="nxs-gr-k" />
    </span>
  );
}

function Body({ style }: { style: SwitchStyleId }) {
  switch (style) {
    case "power":
      return (
        <span className="nxs-power">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 3v8" />
            <path d="M6.3 7.2a8 8 0 1 0 11.4 0" />
          </svg>
        </span>
      );
    case "rocker":
      return (
        <span className="nxs-rocker">
          <span className="nxs-r-on">I</span>
          <span className="nxs-r-off">O</span>
        </span>
      );
    case "pair":
      return (
        <span className="nxs-pair">
          <span data-set="on">ON</span>
          <span data-set="off">OFF</span>
        </span>
      );
    case "lever":
      return <span className="nxs-lever" />;
    case "daynight":
      return (
        <span className="nxs-dn">
          <span className="nxs-dn-day" />
          <span className="nxs-dn-k" />
        </span>
      );
    case "cyber":
      return (
        <span className="nxs-cy">
          <span className="nxs-cy-k" />
        </span>
      );
    case "neon":
      return (
        <span className="nxs-nr">
          <span className="nxs-nr-glow" />
          <span className="nxs-nr-ring" />
          <span className="nxs-nr-k" />
        </span>
      );
    case "gears":
      return <Gears />;
    case "led":
      return (
        <span className="nxs-led-row">
          <span className="nxs-led-a" />
          <span className="nxs-led">
            <span className="nxs-led-k" />
          </span>
          <span className="nxs-led-b" />
        </span>
      );
    case "bigknob":
      return (
        <span className="nxs-bk">
          <span className="nxs-bk-k" />
        </span>
      );
    default:
      return null;
  }
}

/**
 * The picture of a switch in one of the styles. It is not a button itself: the tile around it
 * is (an "ON / OFF pair" marks its halves with data-set="on" / "off" for the tile to read).
 * "toggle" and "tile" draw nothing here: the tile uses the classic switch or lights up itself.
 */
export function SwitchStyleVisual({
  style,
  on,
  disabled = false,
  fontSize,
}: {
  style: SwitchStyleId;
  on: boolean;
  disabled?: boolean;
  /** Fixed size (e.g. in a style picker) instead of fitting the tile. */
  fontSize?: string;
}) {
  const size = FOOTPRINT[style];
  if (!size) return null;
  return (
    <span
      className="nxs"
      data-on={on ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      aria-hidden="true"
      style={{ "--w": size[0], "--h": size[1], ...(fontSize ? { fontSize } : {}) } as CSSProperties}
    >
      <Body style={style} />
    </span>
  );
}

/** "Tile lights up": the glow behind the whole tile. */
export function SwitchTileFill({ on }: { on: boolean }) {
  return <span className="nxs-tilefill" data-on={on ? "true" : "false"} aria-hidden="true" />;
}
