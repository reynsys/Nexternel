import type { ThemePrefs } from "../skins/themePrefs";

/**
 * Messages between the Appearance page and its preview (/look-preview, a page of its own inside it,
 * so the preview has its own Look: every Look styles the whole page it is on).
 */
export const LOOK_PREVIEW_PATH = "/look-preview";
export const LOOK_PREVIEW_READY = "nx-look-preview-ready";
export const LOOK_PREVIEW_PREFS = "nx-look-preview-prefs";
export const LOOK_PREVIEW_HEIGHT = "nx-look-preview-height";

export type LookPreviewMessage =
  | { type: typeof LOOK_PREVIEW_READY }
  | { type: typeof LOOK_PREVIEW_PREFS; prefs: ThemePrefs; skinId: string }
  | { type: typeof LOOK_PREVIEW_HEIGHT; height: number };

/** What the page draws (?show=…): a dashboard section, a Look's sample (Look tiles) or buttons (button style tiles). */
export type LookPreviewShow = "dashboard" | "look" | "buttons";
