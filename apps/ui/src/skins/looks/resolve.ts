import type { Theme } from "@mui/material/styles";
import { standardLook } from "./builtin";
import type { LookTokens, UiLook } from "./types";

/** Every role's value for this Look: its own, and Standard's for anything it leaves out. */
export function resolveTokens(look: UiLook, theme: Theme): LookTokens {
  const standard = standardLook.tokens(theme) as LookTokens;
  return look === standardLook ? standard : { ...standard, ...look.tokens(theme) };
}
