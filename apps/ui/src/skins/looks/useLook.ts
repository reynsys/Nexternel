import { useOptionalSkin } from "../SkinProvider";
import { resolveLook } from "./registry";
import type { UiLook } from "./types";

/** The Look being shown (Standard outside the app shell, e.g. in tests). */
export function useLook(): UiLook {
  return resolveLook(useOptionalSkin()?.themePrefs.lookId);
}
