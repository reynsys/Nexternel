import type { LookFont } from "../skins/looks/types";

/** The font chosen for a Look: the person's choice when the Look offers it, else the Look's first. */
export function chosenLookFont(look: { fonts?: LookFont[] }, fontId: string | undefined): LookFont | undefined {
  return look.fonts?.find((f) => f.id === fontId) ?? look.fonts?.[0];
}
