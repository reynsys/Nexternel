import { normalizePanelKind } from "../panel-kind";
import type { PanelScopeConfig } from "../panel-scope";
import { effectivePanelScope } from "../panel-scope";
import { canonicalCapabilityIds } from "./capability-store";
import { stableResolverKey } from "./resolver-cache";

function sortedUnique(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

/**
 * Identity of a capability-query operation. Scope sets are sorted; manually
 * selected capability order is preserved because it controls result order.
 */
export function panelCapabilityResolverKey(
  panelKind: string,
  scope: PanelScopeConfig,
  sectionAreaId: string | null = null
): string {
  const effective = effectivePanelScope(scope, sectionAreaId);
  return stableResolverKey("capability-query", {
    panelKind: normalizePanelKind(panelKind),
    scope: {
      areaIds: sortedUnique(effective.areaIds),
      systemIds: sortedUnique(effective.systemIds),
      groupIds: sortedUnique(effective.groupIds),
      contentMode: effective.contentMode,
      capabilityIds:
        effective.contentMode === "manual"
          ? effective.capabilityIds.map((id) => id.trim()).filter(Boolean)
          : canonicalCapabilityIds(effective.capabilityIds),
    },
  });
}
