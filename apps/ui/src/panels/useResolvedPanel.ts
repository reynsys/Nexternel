import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ResolvedPanelCapability } from "../api";
import {
  panelCapabilityResolverKey,
  useCapabilitiesWithLiveState,
  useDashboardDataRuntime,
  type ResolverEnvelope,
  type ResolverLease,
} from "../lib/dashboard-data-runtime";
import type { PanelScopeConfig } from "../lib/panel-scope";
import { effectivePanelScope } from "../lib/panel-scope";
import { normalizePanelKind } from "../lib/panel-kind";
import { isIntegrationPanelKind } from "../lib/panel-integration";

type ResolvedPanelContext = {
  panelKind: string;
  areaIds: string[];
  systemIds: string[];
  groupIds: string[];
};

const IDLE_ENVELOPE: ResolverEnvelope<
  ResolvedPanelCapability[],
  ResolvedPanelContext
> = {
  status: "idle",
  data: null,
  context: null,
  subscriptionKeys: [],
  dataVersion: 0,
  error: null,
};

export function useResolvedPanel(
  panelKind: string,
  panelScope: PanelScopeConfig,
  sectionAreaId?: string | null
): {
  capabilities: ResolvedPanelCapability[];
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const runtime = useDashboardDataRuntime();
  const resolverLease = useRef<
    ResolverLease<ResolvedPanelCapability[], ResolvedPanelContext> | null
  >(null);
  const panelScopeRef = useRef(panelScope);
  const sectionAreaRef = useRef(sectionAreaId ?? null);
  panelScopeRef.current = panelScope;
  sectionAreaRef.current = sectionAreaId ?? null;

  const [envelope, setEnvelope] = useState(IDLE_ENVELOPE);
  const [reloadNonce, setReloadNonce] = useState(0);

  const kind = normalizePanelKind(panelKind);
  const shouldResolve =
    !isIntegrationPanelKind(kind) && kind !== "panel.camera";
  const areaId = sectionAreaId ?? null;
  const resolverKey = panelCapabilityResolverKey(kind, panelScope, areaId);

  useEffect(() => {
    resolverLease.current?.release();
    resolverLease.current = null;

    if (!shouldResolve) {
      setEnvelope({
        status: "ready",
        data: [],
        context: null,
        subscriptionKeys: [],
        dataVersion: 0,
        error: null,
      });
      return;
    }

    const force = reloadNonce > 0;
    const scope = effectivePanelScope(panelScopeRef.current, sectionAreaRef.current);

    const unsubscribe = runtime.resolvers.subscribe<
      ResolvedPanelCapability[],
      ResolvedPanelContext
    >(resolverKey, (next) => {
      runtime.capabilities.seed(next.data ?? []);
      setEnvelope(next);
    });

    const cached = runtime.resolvers.peek<
      ResolvedPanelCapability[],
      ResolvedPanelContext
    >(resolverKey);
    if (cached && !force) {
      runtime.capabilities.seed(cached.data ?? []);
      setEnvelope(cached);
    } else {
      setEnvelope((current) => ({
        ...current,
        status: "loading",
        error: null,
      }));
    }

    const lease = runtime.resolvers.acquire<
      ResolvedPanelCapability[],
      ResolvedPanelContext
    >(
      resolverKey,
      async (signal) => {
        const result = await runtime.resolvePanel(
          {
            panelKind: kind,
            panelScope: scope,
          },
          signal
        );
        return {
          data: result.capabilities,
          context: {
            panelKind: result.panelKind,
            areaIds: result.panelScope.areaIds,
            systemIds: result.panelScope.systemIds,
            groupIds: result.panelScope.groupIds,
          },
          subscriptionKeys: result.capabilities.map((cap) => cap.id),
        };
      },
      { force }
    );
    resolverLease.current = lease;

    return () => {
      unsubscribe();
      resolverLease.current?.release();
      resolverLease.current = null;
    };
  }, [resolverKey, kind, runtime, shouldResolve, reloadNonce]);

  const reload = useCallback(() => {
    setReloadNonce((nonce) => nonce + 1);
  }, []);

  const baseCapabilities = envelope.data ?? [];
  const capabilities = useCapabilitiesWithLiveState(
    baseCapabilities,
    envelope.subscriptionKeys
  );

  return {
    capabilities,
    loading: envelope.status === "idle" || envelope.status === "loading",
    error: envelope.error?.message ?? null,
    reload,
  };
}
