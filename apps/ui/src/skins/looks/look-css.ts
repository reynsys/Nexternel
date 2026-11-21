import type { UiLook } from "./types";

/**
 * Where a Look's own CSS applies. A Look is placed on a box: the page (<html data-nx-look>) or a box
 * inside it with a Look of its own (a Look tile in Settings → Appearance). Each Look's rules reach
 * only what is inside a box of that Look, and stop at any box inside it that has its own Look.
 *
 * A Look writes its rules from the box: `:scope[data-nx-look="glass"] [data-nx-role="popup"] { … }`,
 * `:scope[data-nx-buttons="fill-wipe"] .MuiButton-root { … }`. Fonts and animations may sit among them.
 */
export const LOOK_SCOPE = "@scope ([data-nx-look]) to ([data-nx-look])";

/** A Look's CSS written from its box (`:scope[…]`). CSS from older packs is written for the whole page (`:root[…]`). */
export function cssIsPerBox(css: string): boolean {
  return /:scope\b/.test(css);
}

/** Whether this browser can keep CSS to a box (@scope: Chrome 118, Safari 17.4, Firefox 146 and newer). */
export function browserCanScope(): boolean {
  return typeof globalThis !== "undefined" && "CSSScopeRule" in globalThis;
}

/**
 * The CSS for every Look available here, each once (the HUD Looks share one pack's CSS), limited
 * to their boxes. CSS from an older pack, written for the whole page, is used only while its Look is
 * the page's (as before): it cannot be limited to a box. A browser that cannot keep CSS to a box gets
 * only the page's Look's CSS, for the whole page (`:scope` alone means the page there), as before.
 */
export function lookStyleSheet(looks: UiLook[], pageLookId: string, canScope = browserCanScope()): string {
  const perBox = new Set<string>();
  const wholePage = new Set<string>();
  for (const look of looks) {
    if (!look.css) continue;
    if (canScope && cssIsPerBox(look.css)) perBox.add(look.css);
    else if (look.id === pageLookId) wholePage.add(look.css);
  }
  const parts = [...wholePage];
  if (perBox.size) parts.push(`${LOOK_SCOPE} {\n${[...perBox].join("\n")}\n}`);
  return parts.join("\n");
}
