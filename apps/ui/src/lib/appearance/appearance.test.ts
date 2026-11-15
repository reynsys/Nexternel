import test from "node:test";
import assert from "node:assert/strict";
import { contrast, hexToOklch, oklchToHex } from "./color.ts";
import { buildScale, harmonyColours, HARMONIES } from "./scale.ts";
import { buildScheme } from "./scheme.ts";
import { THEME_PRESETS } from "./presets.ts";

/** Repeatable "random" colours, so a failure can be found again. */
function colours(count: number): string[] {
  let seed = 7;
  const next = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: count }, () =>
    "#" + [0, 0, 0].map(() => Math.floor(next() * 256).toString(16).padStart(2, "0")).join("")
  );
}

test("colours survive the trip through OKLCH", () => {
  for (const hex of ["#1A73E8", "#F4511E", "#00897B", "#FFFFFF", "#000000", "#777777"]) {
    assert.equal(oklchToHex(hexToOklch(hex)), hex);
  }
});

test("contrast follows WCAG 2: black on white is 21, a colour on itself is 1", () => {
  assert.equal(Math.round(contrast("#000000", "#FFFFFF")), 21);
  assert.equal(contrast("#1A73E8", "#1A73E8"), 1);
});

test("a scale has twelve shades going one way in lightness (light mode lighter first, dark mode darker first)", () => {
  for (const mode of ["light", "dark"] as const) {
    const s = buildScale("#1A73E8", mode);
    assert.equal(s.length, 12);
    const l = s.map((h) => hexToOklch(h).l);
    for (let i = 1; i < 8; i++) assert.ok(mode === "light" ? l[i] < l[i - 1] : l[i] > l[i - 1], `${mode} shade ${i + 1}`);
  }
});

test("harmonies give two colours different from the main one", () => {
  for (const h of HARMONIES.filter((x) => x.id !== "custom")) {
    const [a, b] = harmonyColours("#1A73E8", h.id as Exclude<typeof h.id, "custom">);
    assert.notEqual(a, "#1A73E8");
    assert.notEqual(b, a);
  }
});

test("every pairing is readable, for any main colour, harmony and mode (solid surfaces)", () => {
  for (const main of colours(120)) {
    for (const mode of ["light", "dark"] as const) {
      for (const harmony of ["split", "analogous", "triadic", "complementary"] as const) {
        const s = buildScheme({ mode, surfaces: "solid", main, harmony });
        const bad = s.audit.filter((a) => !a.pass);
        assert.deepEqual(bad, [], `${main} ${mode} ${harmony}`);
      }
    }
  }
});

test("see-through (glass) surfaces stay readable over backgrounds that suit the mode", () => {
  const darkBackgrounds = ["#0B1430", "#1D0B2E", "#06281F", "#2A1206"];
  const lightBackgrounds = ["#E8EEF9", "#F6E9F2", "#E6F4EE", "#FBF1E4"];
  for (const main of colours(60)) {
    for (const [mode, bgs] of [["dark", darkBackgrounds], ["light", lightBackgrounds]] as const) {
      const s = buildScheme({ mode, surfaces: "glass", main, harmony: "split", backgroundColours: [...bgs] });
      const bad = s.audit.filter((a) => !a.pass);
      assert.deepEqual(bad, [], `${main} ${mode}`);
    }
  }
});

test("custom second and third colours are used, made readable but keeping their colour", () => {
  const s = buildScheme({ mode: "dark", surfaces: "solid", main: "#1A73E8", harmony: "custom", second: "#F4511E", third: "#00897B" });
  assert.equal(s.input.second, "#F4511E");
  const hue = (h: string) => hexToOklch(h).h;
  assert.ok(Math.abs(hue(s.roles.second.solid) - hue("#F4511E")) < 6);
  assert.ok(s.audit.every((a) => a.pass));
});

test("a panel row keeps room for the frame, the title and content", async () => {
  const { minPanelRowPx } = await import("../panel-heading.ts");
  assert.equal(minPanelRowPx("4px"), 4 + 4 + 30 + 6 + 32);
  assert.equal(minPanelRowPx("7px 8px 13px"), 7 + 13 + 30 + 6 + 32);
});

test("ready-made themes: readable in Light and Dark, clear of OK/Attention/Alarm, and none alike", () => {
  // How far apart two colours look (OKLab distance).
  const apart = (a: string, b: string) => {
    const A = hexToOklch(a), B = hexToOklch(b), r = Math.PI / 180;
    return Math.hypot(A.l - B.l, A.c * Math.cos(A.h * r) - B.c * Math.cos(B.h * r), A.c * Math.sin(A.h * r) - B.c * Math.sin(B.h * r));
  };
  const scheme = (p: (typeof THEME_PRESETS)[number], mode: "light" | "dark", surfaces: "solid" | "glass") =>
    buildScheme({ mode, surfaces, main: p.primary, harmony: p.harmony, second: p.second, third: p.third, tint: p.tint });
  for (const p of THEME_PRESETS)
    for (const mode of ["light", "dark"] as const) {
      for (const surfaces of ["solid", "glass"] as const)
        assert.deepEqual(scheme(p, mode, surfaces).audit.filter((a) => !a.pass), [], `${p.label} ${mode} ${surfaces}`);
      const r = scheme(p, mode, "solid").roles;
      for (const k of ["main", "second", "third"] as const)
        for (const [st, roles] of Object.entries(r.status))
          assert.ok(apart(r[k].solid, roles.solid) >= 0.1, `${p.label} ${mode}: its ${k} colour looks like the ${st} status colour`);
      if (mode === "dark")
        for (const [st, roles] of Object.entries(r.status))
          assert.ok(apart(r.value, roles.text) >= 0.1, `${p.label}: readings look like ${st} text`);
    }
  const hues = THEME_PRESETS.map((p) => hexToOklch(p.primary).h);
  const readings = THEME_PRESETS.map((p) => scheme(p, "dark", "solid").roles.value);
  for (let i = 0; i < THEME_PRESETS.length; i++)
    for (let j = i + 1; j < THEME_PRESETS.length; j++) {
      const d = Math.abs(hues[i] - hues[j]);
      assert.ok(Math.min(d, 360 - d) >= 25, `${THEME_PRESETS[i].label} and ${THEME_PRESETS[j].label} main colours are too alike`);
      assert.ok(apart(readings[i], readings[j]) >= 0.045, `${THEME_PRESETS[i].label} and ${THEME_PRESETS[j].label} readings look alike`);
    }
});
