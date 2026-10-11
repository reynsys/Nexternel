/** Brand mark next to “Nexternel” in the side menu. */

export const BRAND_LOGO_KEY = "nexternel.brandLogo";

const MAX_CHARS = 350_000;
const DATA_URL = /^data:image\/(jpeg|jpg|png|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/i;

export function getBrandLogo(): string | null {
  try {
    const v = localStorage.getItem(BRAND_LOGO_KEY);
    if (!v || !DATA_URL.test(v) || v.length > MAX_CHARS) return null;
    return v;
  } catch {
    return null;
  }
}

export function setBrandLogo(dataUrl: string | null): void {
  try {
    if (!dataUrl) {
      localStorage.removeItem(BRAND_LOGO_KEY);
      return;
    }
    if (!DATA_URL.test(dataUrl) || dataUrl.length > MAX_CHARS) {
      throw new Error("Invalid logo image");
    }
    localStorage.setItem(BRAND_LOGO_KEY, dataUrl);
  } catch {
    /* ignore quota */
  }
}

export async function fileToBrandLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const max = 96;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}
