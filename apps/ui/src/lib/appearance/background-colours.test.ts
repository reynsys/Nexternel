import test from "node:test";
import assert from "node:assert/strict";
import { backgroundColours, backgroundHasColours, MINE_GLOW_ID, MINE_GRADIENT_ID } from "../../skins/appearance-scheme.ts";
import { GLOW_PALETTES, GRADIENT_PALETTES, GRADIENT_NONE_ID } from "../../skins/gradientPalettes.ts";
import type { ThemePrefs } from "../../skins/themePrefs.ts";

const prefs = (gradientId: string | undefined, more: Partial<ThemePrefs> = {}) =>
  ({ mode: "dark", primary: "#1A73E8", harmony: "custom", second: "#F4511E", third: "#00897B", gradientId, ...more }) as ThemePrefs;

test("a background from my colours gives the effect all three of them", () => {
  for (const id of [MINE_GLOW_ID, MINE_GRADIENT_ID]) {
    for (const mode of ["light", "dark"] as const) {
      const colours = backgroundColours(prefs(id), mode);
      assert.equal(new Set(colours).size, 3);
      for (const c of colours) assert.match(c, /^#[0-9a-f]{6}$/i);
    }
    assert.notDeepEqual(backgroundColours(prefs(id), "dark"), backgroundColours(prefs(id, { second: "#AA00FF" }), "dark"));
  }
});

test("a ready-made background gives its own colours, a plain one none", () => {
  assert.equal(backgroundColours(prefs(GLOW_PALETTES[0]!.id), "dark").length, 3);
  assert.equal(backgroundColours(prefs(GRADIENT_PALETTES[0]!.id), "dark")[0]!.toLowerCase(), GRADIENT_PALETTES[0]!.from.toLowerCase());
  for (const id of [GRADIENT_NONE_ID, undefined]) {
    assert.deepEqual(backgroundColours(prefs(id), "dark"), []);
    assert.equal(backgroundHasColours(id), false);
  }
});
