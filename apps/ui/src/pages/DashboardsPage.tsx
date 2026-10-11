import { ManageDashboardsPanel } from "../components/ManageDashboardsPanel";

/** Standalone route `/manage/dashboards` (deep link). Prefer gear → Dashboard options. */
export function DashboardsPage() {
  return <ManageDashboardsPanel />;
}
