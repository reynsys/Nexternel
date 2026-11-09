/**
 * A phone: a touch screen whose short side is under 600 points (Android's own line between phones and
 * tablets). Turning the phone sideways keeps it a phone; tablets and computers are not phones.
 * A phone keeps its own Appearance (skins/SkinProvider.tsx), so changing it there leaves your other
 * screens as they are.
 */
export function isPhoneScreen(): boolean {
  if (typeof window === "undefined") return false;
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const short = Math.min(window.screen?.width ?? Infinity, window.screen?.height ?? Infinity);
  return touch && short < 600;
}
