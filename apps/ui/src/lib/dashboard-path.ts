/**
 * Readable dashboard addresses. The default dashboard is `/`; every other one is
 * `/d/<name>` (e.g. `/d/kids-bedroom`). Worked out from names on every load, so nothing
 * extra is stored and a backup/restore or a fresh install cannot leave a stale address.
 * Old `/dashboards/<id>` links keep working and are rewritten to the readable form.
 */

type DashboardRef = { id: string; name: string; isDefault?: boolean };

/** "Kids Bedroom" → "kids-bedroom"; accents dropped; never empty. */
export function dashboardSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "dashboard";
}

/** Address for every dashboard in list order; a repeated name gets `-2`, `-3`, … */
export function dashboardPaths(list: readonly DashboardRef[]): Map<string, string> {
  const paths = new Map<string, string>();
  const used = new Map<string, number>();
  for (const d of list) {
    if (d.isDefault) {
      paths.set(d.id, "/");
      continue;
    }
    const base = dashboardSlug(d.name);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    paths.set(d.id, `/d/${n === 1 ? base : `${base}-${n}`}`);
  }
  return paths;
}

export function dashboardPath(d: DashboardRef, list: readonly DashboardRef[]): string {
  return dashboardPaths(list).get(d.id) ?? `/dashboards/${d.id}`;
}

/** Dashboard id for a `/d/<slug>` address, or null when no dashboard has that name. */
export function dashboardIdForSlug(list: readonly DashboardRef[], slug: string): string | null {
  const wanted = `/d/${slug.toLowerCase()}`;
  for (const [id, path] of dashboardPaths(list)) {
    if (path === wanted) return id;
  }
  // The default dashboard also answers to its own name.
  const def = list.find((d) => d.isDefault && dashboardSlug(d.name) === slug.toLowerCase());
  return def?.id ?? null;
}
