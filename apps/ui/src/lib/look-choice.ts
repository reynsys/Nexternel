/**
 * Which Look a person has chosen (Settings → Appearance → Look). Pure rules, no React or MUI,
 * so the API, the UI and tests agree.
 *
 * Before Looks existed, the "Panels" setting chose frosted glass or solid panels. Prefs saved
 * then have no lookId: frosted panels over a background become the Glass Look, anything else
 * Standard, so nobody's dashboard changes when Looks arrive.
 */

export const STANDARD_LOOK_ID = "standard";
export const GLASS_LOOK_ID = "glass";

/** Look ids are short lowercase names (also the folder name of a Look pack). */
const LOOK_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function isLookId(raw: unknown): raw is string {
  return typeof raw === "string" && LOOK_ID.test(raw);
}

/**
 * The stored Look id. A Look that is not installed here (a pack on another server) is kept,
 * so it comes back where it is installed; showing falls back to Standard (see resolveLook).
 */
export function lookIdFromPrefs(prefs: {
  lookId?: unknown;
  solidContentPanels?: unknown;
  backdrop: boolean;
}): string {
  if (isLookId(prefs.lookId)) return prefs.lookId;
  return prefs.backdrop && !prefs.solidContentPanels ? GLASS_LOOK_ID : STANDARD_LOOK_ID;
}
