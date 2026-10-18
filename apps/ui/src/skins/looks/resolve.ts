import type { Theme } from "@mui/material/styles";
import { standardLook } from "./builtin";
import { chosenLookFont } from "../../lib/look-font";
import type { LookTokens, UiLook } from "./types";

export { chosenLookFont };

/** Every role's value for this Look: its own, and Standard's for anything it leaves out. */
export function resolveTokens(look: UiLook, theme: Theme, fontId?: string): LookTokens {
  const standard = standardLook.tokens(theme) as LookTokens;
  if (look === standardLook) return standard;
  const font = chosenLookFont(look, fontId);
  return { ...standard, ...look.tokens(theme), ...(font ? { font: font.family } : {}) };
}
