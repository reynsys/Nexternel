/** Nexternel Backend API — Generation 5 (V5 Constitution) */
export const VERSION_GENERATION = 5;
/** Major update (named "hardware" for history; since 07/11/2026 it counts major updates with new features). */
export const VERSION_HARDWARE = 2;
export const VERSION_SOFTWARE = 197;

export function formatVersion(
  gen = VERSION_GENERATION,
  hw = VERSION_HARDWARE,
  sw = VERSION_SOFTWARE
): string {
  return `V${gen}.${hw}.${sw}`;
}

export const APP_VERSION = formatVersion();
