import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { api, connectLiveSocket } from "../../api";
import { canonicalCapabilityIds } from "./capability-store";
import {
  DashboardDataRuntime,
  type LiveConnectionFactory,
} from "./runtime";
import type {
  CapabilityStateSnapshot,
  PanelActivity,
} from "./types";
import { panelActivityIsActive } from "./types";
import type { CapabilityStatus } from "./status-store";

const DashboardDataRuntimeContext =
  createContext<DashboardDataRuntime | null>(null);

type Props = {
  children: ReactNode;
  connectLive?: LiveConnectionFactory;
};

export function DashboardDataRuntimeProvider({
  children,
  connectLive = connectLiveSocket,
}: Props) {
  const [runtime] = useState(
    () =>
      new DashboardDataRuntime(
        connectLive,
        async (requests, signal) =>
          (
            await api.resolvePanelsBatch([...requests], { signal })
          ).results
      )
  );

  useEffect(() => {
    runtime.start();
    return () => runtime.stop();
  }, [runtime]);

  return (
    <DashboardDataRuntimeContext.Provider value={runtime}>
      {children}
    </DashboardDataRuntimeContext.Provider>
  );
}

/** The runtime when inside a dashboard, else null (previews, editors). */
export function useOptionalDashboardDataRuntime(): DashboardDataRuntime | null {
  return useContext(DashboardDataRuntimeContext);
}

/** One reading's status light, kept live; null outside a dashboard or for readings without a light. */
export function useCapabilityStatus(capabilityId: string | null | undefined): CapabilityStatus | null {
  const runtime = useContext(DashboardDataRuntimeContext);
  const subscribe = useCallback(
    (listener: () => void) =>
      runtime && capabilityId ? runtime.statuses.subscribe(capabilityId, listener) : () => undefined,
    [runtime, capabilityId]
  );
  const get = useCallback(
    () => (runtime && capabilityId ? runtime.statuses.get(capabilityId) : null),
    [runtime, capabilityId]
  );
  return useSyncExternalStore(subscribe, get, get);
}

export function useDashboardDataRuntime(): DashboardDataRuntime {
  const runtime = useContext(DashboardDataRuntimeContext);
  if (!runtime) {
    throw new Error(
      "Dashboard data consumers must be inside DashboardDataRuntimeProvider"
    );
  }
  return runtime;
}

type CapabilityWithState = {
  id: string;
  state: CapabilityStateSnapshot | null;
};

/**
 * Merge live state into a stable metadata/result array. The external-store
 * subscription only listens to requested ids.
 */
export function useCapabilitiesWithLiveState<T extends CapabilityWithState>(
  capabilities: readonly T[],
  capabilityIds: readonly string[],
  activity: PanelActivity = "visible"
): T[] {
  const runtime = useDashboardDataRuntime();
  const idsKey = canonicalCapabilityIds(capabilityIds).join("|");
  const ids = useMemo(
    () => (idsKey ? idsKey.split("|") : []),
    [idsKey]
  );
  const active = panelActivityIsActive(activity);

  const subscribe = useCallback(
    (listener: () => void) =>
      active
        ? runtime.capabilities.subscribe(ids, listener)
        : () => undefined,
    [active, idsKey, runtime]
  );
  const getSnapshot = useCallback(
    () => (active ? runtime.capabilities.revision(ids) : "inactive"),
    [active, idsKey, runtime]
  );
  const revision = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );

  return useMemo(() => {
    if (!active || ids.length === 0) return [...capabilities];
    const selected = new Set(ids);
    return capabilities.map((capability) => {
      if (!selected.has(capability.id)) return capability;
      const state = runtime.capabilities.get(capability.id);
      return state ? { ...capability, state } : capability;
    });
  }, [active, capabilities, idsKey, revision, runtime]);
}
