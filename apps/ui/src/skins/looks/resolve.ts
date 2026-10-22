import type { Theme } from "@mui/material/styles";
import { standardLook } from "./builtin";
import { chosenLookFont } from "../../lib/look-font";
import type { LookTokens, UiLook } from "./types";
import { coreFont } from "../../lib/appearance/fonts";

export { chosenLookFont };

/**
 * The font in use: the Look's own font of that name (packs may tune theirs), else Nexternel's built-in
 * font of that name (every style can use them), else the Look's first font, else Inter.
 */
export function fontFamilyFor(look: UiLook, fontId?: string): string | undefined {
  const own = fontId ? look.fonts?.find((f) => f.id === fontId) : undefined;
  if (own) return own.family;
  const builtIn = coreFont(fontId);
  if (builtIn) return builtIn.family;
  return chosenLookFont(look, undefined)?.family;
}

/** Every role's value for this Look: its own, and Standard's for anything it leaves out. */
export function resolveTokens(look: UiLook, theme: Theme, fontId?: string): LookTokens {
  const standard = standardLook.tokens(theme) as LookTokens;
  const font = fontFamilyFor(look, fontId);
  const own = look === standardLook ? {} : look.tokens(theme);
  return { ...standard, ...own, ...(font ? { font } : {}) };
}
