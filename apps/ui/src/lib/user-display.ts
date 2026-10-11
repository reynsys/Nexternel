/** Resize an image file to a small JPEG data URL for user avatars. */

const MAX_EDGE = 160;
const JPEG_QUALITY = 0.85;

export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPEG, PNG, or WebP)");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}

export function roleLabel(role: string | null | undefined, roleName?: string | null): string {
  if (roleName?.trim()) return roleName.trim();
  if (role === "admin") return "Administrator";
  if (role === "viewer") return "Viewer";
  return role?.trim() || "";
}

export function userInitial(user: {
  displayName?: string | null;
  username?: string;
} | null): string {
  const label = (user?.displayName || user?.username || "?").trim();
  return label.slice(0, 1).toUpperCase() || "?";
}
