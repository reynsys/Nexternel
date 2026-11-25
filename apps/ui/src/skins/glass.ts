/*
 * Frosted glass blurs whatever is behind it. Over a moving background effect that blur must be
 * redone every frame (it halved the frame rate in tests), so while an effect runs
 * BackgroundEffects sets --nx-glass-blur to none and adds --nx-glass-tint, a thicker fill instead.
 * Every blur in Nexternel goes through these (a test refuses any other): one part still blurring over
 * a moving effect slows the whole page (the dock alone took a dashboard from 115 to 19 pictures a second).
 */
export const GLASS_BLUR = (px: number, more = "") => `var(--nx-glass-blur, blur(${px}px)${more})`;
export const GLASS_TINT = "linear-gradient(var(--nx-glass-tint, transparent), var(--nx-glass-tint, transparent))";
/** Over other panels and text (dock, bars, side panels, pop-ups): thicker, so what is under it does not show through. */
export const FLOATING_TINT = [GLASS_TINT, GLASS_TINT, GLASS_TINT, GLASS_TINT].join(", ");
