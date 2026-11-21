import assert from "node:assert/strict";
import test from "node:test";
import type { UiLook } from "../skins/looks/types";
import { LOOK_SCOPE, lookStyleSheet } from "../skins/looks/look-css.ts";

const look = (id: string, css?: string) => ({ id, label: id, description: "", frosted: false, tokens: () => ({}), css }) as UiLook;

test("every Look's own CSS is kept to boxes of that Look, each pack's CSS once", () => {
  const hud = ':scope[data-nx-look^="hud-"] .MuiButton-root { color: red; }';
  const glass = ':scope[data-nx-look="glass"] [data-nx-role="popup"] { color: blue; }';
  const css = lookStyleSheet([look("standard"), look("glass", glass), look("hud-line", hud), look("hud-glass", hud)], "glass", true);
  assert.ok(css.startsWith(`${LOOK_SCOPE} {`));
  assert.equal(css.split(hud).length - 1, 1, "the HUD pack's CSS is there once for its three Looks");
  assert.ok(css.includes(glass));
});

test("CSS from an older pack, written for the whole page, is used only while its Look is the page's", () => {
  const old = ':root[data-nx-look^="hud-"] .MuiButton-root { color: red; }';
  assert.equal(lookStyleSheet([look("hud-line", old)], "glass", true), "");
  assert.equal(lookStyleSheet([look("hud-line", old)], "hud-line", true), old);
});

test("a browser that cannot keep CSS to a box gets the page's Look's CSS for the whole page", () => {
  const hud = ':scope[data-nx-look^="hud-"] .MuiButton-root { color: red; }';
  const glass = ':scope[data-nx-look="glass"] [data-nx-role="popup"] { color: blue; }';
  assert.equal(lookStyleSheet([look("glass", glass), look("hud-line", hud)], "hud-line", false), hud);
});
