/** Nexternel Backend API — Generation 5 (V5 Constitution) */
export const VERSION_GENERATION = 5;
export const VERSION_HARDWARE = 2;
export const VERSION_SOFTWARE = 147;

export function formatVersion(
  gen = VERSION_GENERATION,
  hw = VERSION_HARDWARE,
  sw = VERSION_SOFTWARE
): string {
  return `V${gen}.${hw}.${sw}`;
}

export const APP_VERSION = formatVersion();
