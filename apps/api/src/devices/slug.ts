export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** e.g. `damnhome/living-room` → `living-room` */
export function deviceSlugFromTopicPrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/\/+$/, "");
  const last = trimmed.split("/").filter(Boolean).pop();
  return last ? slugify(last) : "";
}

export function friendlyDeviceName(esphomeName: string): string {
  return esphomeName
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
