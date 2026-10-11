/**
 * Popular two-colour gradients for Appearance → Gradient background.
 * Inspired by https://www.color-meanings.com/gradient-color-palettes/
 */

type Rgb = [number, number, number];

export type GradientPalette = {
  id: string;
  label: string;
  from: string;
  to: string;
  /** CSS angle, e.g. 135deg */
  angle?: string;
  /** Soft glow: three pools of light over a deep base (the former Gaussian themes). */
  glow?: { pools: [Rgb, Rgb, Rgb]; base: [string, string, string] };
};

export const GRADIENT_NONE_ID = "none";

export const GRADIENT_PALETTES: GradientPalette[] = [
  { id: "watermelon-crush", label: "Watermelon Crush", from: "#DB2763", to: "#B0DB43" },
  { id: "sedona-sunrise", label: "Sedona Sunrise", from: "#E43D00", to: "#FFE900" },
  { id: "seascape", label: "Seascape", from: "#E4F3E3", to: "#5CA9E9" },
  { id: "blackcurrant", label: "Blackcurrant", from: "#212130", to: "#39304A" },
  { id: "cotton-candy", label: "Cotton Candy", from: "#BCE7FC", to: "#C491B1" },
  { id: "carrot", label: "Carrot", from: "#D36135", to: "#80B069" },
  { id: "honeydew", label: "Honeydew", from: "#DAFF7D", to: "#B2EE9B" },
  { id: "spotlight", label: "Spotlight", from: "#350068", to: "#FF6978" },
  { id: "nectarine", label: "Nectarine", from: "#F7DBA7", to: "#F0AB86" },
  { id: "south-pacific", label: "South Pacific", from: "#022F40", to: "#38AECC" },
  { id: "raspberry-velvet", label: "Raspberry Velvet", from: "#870057", to: "#A5303F" },
  { id: "pink-sands", label: "Pink Sands", from: "#91F1EF", to: "#FFD5E0" },
  { id: "iguana", label: "Iguana", from: "#264653", to: "#2A9D8F" },
  { id: "stormy-skies", label: "Stormy Skies", from: "#505250", to: "#CBD3C1" },
  { id: "jade-aubergine", label: "Jade Aubergine", from: "#51A3A3", to: "#75485E" },
  { id: "hot-and-cold", label: "Hot and Cold", from: "#DA3068", to: "#14469F" },
  { id: "emerald-isle", label: "Emerald Isle", from: "#23CD6B", to: "#272D2D" },
  { id: "cloudburst", label: "Cloudburst", from: "#7FB7BE", to: "#D2F3EE" },
  { id: "ocean-sunsets", label: "Ocean Sunsets", from: "#EDAE48", to: "#D1495B" },
  { id: "lavender-haze", label: "Lavender Haze", from: "#D7B8F3", to: "#B8B8F3" },
  { id: "dust-bowl", label: "Dust Bowl", from: "#584D3C", to: "#9F956C" },
  { id: "pink-clouds", label: "Pink Clouds", from: "#EEBBD5", to: "#2F284E" },
  { id: "azure-mist", label: "Azure Mist", from: "#00C1D0", to: "#0A0F44" },
  { id: "touch-of-gray", label: "Touch of Gray", from: "#FCFAFB", to: "#C8D3D6" },
  { id: "buckskin", label: "Buckskin", from: "#9F7E6A", to: "#D2BA9F" },
  { id: "parakeet", label: "Parakeet", from: "#FCFB62", to: "#91F9E5" },
  { id: "lupine-bloom", label: "Lupine Bloom", from: "#7B4C94", to: "#7D82B9" },
  { id: "amulet", label: "Amulet", from: "#70C1B3", to: "#247B9F" },
  { id: "seashell", label: "Seashell", from: "#C88284", to: "#F3D8DB" },
  { id: "blueberry-blitz", label: "Blueberry Blitz", from: "#301847", to: "#C10214" },
  { id: "lime-sherbet", label: "Lime Sherbet", from: "#17E0BC", to: "#98CE00" },
  { id: "grayscale", label: "Grayscale", from: "#BFBDC1", to: "#6D6975" },
  { id: "asphalt", label: "Asphalt", from: "#474449", to: "#2D232E" },
];

const hexOf = (c: Rgb) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();

function glow(id: string, label: string, pools: [Rgb, Rgb, Rgb], base: [string, string, string]): GradientPalette {
  return { id: `glow-${id}`, label, from: hexOf(pools[0]), to: hexOf(pools[1]), glow: { pools, base } };
}

/** Soft glow backgrounds: pools of light on a deep background. Static — nothing is animated or blurred. */
export const GLOW_PALETTES: GradientPalette[] = [
  glow("blue", "Blue", [[0, 180, 255], [139, 92, 246], [80, 140, 255]], ["#010812", "#031a33", "#041120"]),
  glow("black", "Black", [[150, 160, 180], [90, 100, 125], [200, 205, 215]], ["#050506", "#111215", "#08080a"]),
  glow("amethyst", "Amethyst", [[190, 90, 255], [90, 80, 255], [255, 150, 230]], ["#0d0418", "#1e0b33", "#12061f"]),
  glow("emerald", "Emerald", [[16, 200, 120], [0, 150, 170], [140, 230, 170]], ["#021209", "#063321", "#031a12"]),
  glow("bronze", "Bronze", [[230, 120, 90], [180, 70, 60], [255, 180, 120]], ["#140806", "#331511", "#1c0b08"]),
  glow("gold", "Gold", [[250, 190, 40], [220, 130, 20], [255, 230, 140]], ["#151003", "#33270a", "#1d1505"]),
  glow("aurora", "Aurora", [[40, 255, 170], [120, 90, 255], [0, 200, 255]], ["#020a12", "#06202b", "#050d1a"]),
  glow("sunset", "Sunset", [[255, 110, 80], [200, 60, 140], [255, 190, 90]], ["#12060e", "#2b0f1f", "#170812"]),
  glow("ocean", "Ocean", [[0, 140, 255], [40, 60, 200], [0, 230, 220]], ["#010a14", "#04213a", "#020f1f"]),
  glow("rose", "Rose", [[255, 90, 150], [170, 60, 200], [255, 200, 220]], ["#14050c", "#2e0d1d", "#18060f"]),
];

const BY_ID = new Map([...GRADIENT_PALETTES, ...GLOW_PALETTES].map((p) => [p.id, p]));

export function isGlowId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith("glow-"));
}

/** The palette's colours, for effects coloured "like the background". */
export function paletteColours(id: string | null | undefined): Rgb[] {
  const p = getGradientPalette(id);
  if (!p) return [];
  if (p.glow) return [...p.glow.pools];
  const parse = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
  return [parse(p.from), parse(p.to)];
}

export function getGradientPalette(id: string | null | undefined): GradientPalette | null {
  if (!id || id === GRADIENT_NONE_ID) return null;
  return BY_ID.get(id) ?? null;
}

/** Midpoint blend of two #RRGGBB colours (for “match gradient → accent”). */
export function mixHexColors(a: string, b: string): string {
  const parse = (h: string): [number, number, number] | null => {
    const m = /^#?([0-9A-Fa-f]{6})$/.exec(h.trim());
    if (!m) return null;
    const hex = m[1]!;
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  };
  const ca = parse(a);
  const cb = parse(b);
  if (!ca || !cb) return a.startsWith("#") ? a : `#${a}`;
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex((ca[0] + cb[0]) / 2)}${toHex((ca[1] + cb[1]) / 2)}${toHex(
    (ca[2] + cb[2]) / 2
  )}`;
}

/**
 * A solid colour matching the background's edge — painted under it, so any area the background
 * does not reach (a phone's toolbar sliding away) shows this colour, never white.
 */
export function gradientBaseColour(id: string | null | undefined, mode: "light" | "dark" = "dark"): string | null {
  const p = getGradientPalette(id);
  if (!p) return null;
  if (p.glow) return mode === "light" ? "#eef1f7" : p.glow.base[2];
  return p.to;
}

/** CSS `background-image` value, or null for solid theme background. */
export function gradientCss(id: string | null | undefined, mode: "light" | "dark" = "dark"): string | null {
  const p = getGradientPalette(id);
  if (!p) return null;
  if (p.glow) {
    const [a, b, c] = p.glow.pools;
    const k = mode === "light" ? 1.25 : 1;
    const rgba = (rgb: Rgb, alpha: number) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
    const ground =
      mode === "light"
        ? "linear-gradient(135deg, #f7f8fc, #eef1f7 45%, #f4f2f8)"
        : `linear-gradient(135deg, ${p.glow.base[0]} 0%, ${p.glow.base[1]} 45%, ${p.glow.base[2]} 100%)`;
    return [
      `radial-gradient(circle at 18% 82%, ${rgba(a, 0.3 * k)}, transparent 46%)`,
      `radial-gradient(circle at 88% 12%, ${rgba(b, 0.26 * k)}, transparent 42%)`,
      `radial-gradient(circle at 55% 38%, ${rgba(c, 0.1 * k)}, transparent 40%)`,
      ground,
    ].join(", ");
  }
  const angle = p.angle ?? "135deg";
  return `linear-gradient(${angle}, ${p.from}, ${p.to})`;
}
