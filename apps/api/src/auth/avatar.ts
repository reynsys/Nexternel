/** Validate optional avatar data URLs (client-resized JPEG/PNG). */

const MAX_CHARS = 350_000; // ~260KB binary after base64
const DATA_URL =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i;

export function parseAvatarInput(
  raw: unknown
): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.length > MAX_CHARS) return null;
  if (!DATA_URL.test(v)) return null;
  return v;
}
