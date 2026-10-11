import { api, type DashboardSummary } from "../api";

/**
 * Resolve which dashboard should open at home / login.
 * Promotes the first dashboard to default when none is marked.
 * Returns null when there are no dashboards.
 */
export async function resolveHomeDashboardId(
  list?: DashboardSummary[]
): Promise<string | null> {
  const res = list ? { dashboards: list } : await api.dashboards();
  const dashboards = Array.isArray(res.dashboards) ? res.dashboards : [];
  if (!dashboards.length) return null;

  const existing = dashboards.find((d) => d.isDefault === true);
  if (existing?.id) return existing.id;

  const first = dashboards[0]!;
  try {
    await api.saveDashboard(first.id, { isDefault: true });
  } catch {
    /* still open first */
  }
  return first.id;
}
