import type { LookButtonStyle, LookFont } from "../skins/looks/types";

/** A Look's option the person chose, when the Look offers it; else the Look's first (or none). */
function chosen<T extends { id: string }>(list: T[] | undefined, id: string | undefined): T | undefined {
  return list?.find((o) => o.id === id) ?? list?.[0];
}

/** The font chosen for a Look: the person's choice when the Look offers it, else the Look's first. */
export function chosenLookFont(look: { fonts?: LookFont[] }, fontId: string | undefined): LookFont | undefined {
  return chosen(look.fonts, fontId);
}

/** The button style chosen for a Look, the same way. */
export function chosenLookButtons(look: { buttonStyles?: LookButtonStyle[] }, id: string | undefined): LookButtonStyle | undefined {
  return chosen(look.buttonStyles, id);
}
