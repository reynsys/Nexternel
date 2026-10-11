import { CapabilityStateStore } from "./capability-store";
import {
  PanelResolverBatcher,
  type PanelResolveBatchFetch,
} from "./panel-resolver-batcher";
import { ResolverCache } from "./resolver-cache";
import type {
  PanelResolveRequest,
  PanelResolveResult,
} from "../../api";
import type {
  DashboardLiveEvent,
  LiveCapabilityUpdate,
} from "./types";

export type LiveConnectionFactory = (
  onEvent: (event: DashboardLiveEvent) => void
) => () => void;

export type DashboardDataRuntimeDiagnostics = {
  liveConnectionActive: boolean;
  liveConnectionStarts: number;
  capabilitySubscriptions: number;
  resolverEntries: number;
  resolverBatchesSent: number;
};

/**
 * One runtime belongs to one mounted Dashboard session. Panel subscriptions do
 * not create sockets; the runtime owns the sole live connection.
 */
export class DashboardDataRuntime {
  readonly capabilities = new CapabilityStateStore();
  readonly resolvers = new ResolverCache();
  readonly panelResolvers: PanelResolverBatcher | null;

  private stopLiveConnection: (() => void) | null = null;
  private liveConnectionStarts = 0;
  private readonly connectLive: LiveConnectionFactory;

  constructor(
    connectLive: LiveConnectionFactory,
    resolvePanelBatch?: PanelResolveBatchFetch
  ) {
    this.connectLive = connectLive;
    this.panelResolvers = resolvePanelBatch
      ? new PanelResolverBatcher(resolvePanelBatch)
      : null;
  }

  start(): void {
    if (this.stopLiveConnection) return;
    this.liveConnectionStarts += 1;
    this.stopLiveConnection = this.connectLive((event) =>
      this.applyLiveEvent(event)
    );
  }

  stop(): void {
    this.stopLiveConnection?.();
    this.stopLiveConnection = null;
    this.resolvers.clear();
    this.panelResolvers?.cancelPending();
  }

  applyCapabilityState(update: LiveCapabilityUpdate): void {
    this.capabilities.apply(update);
  }

  resolvePanel(
    request: PanelResolveRequest,
    signal: AbortSignal
  ): Promise<PanelResolveResult> {
    if (!this.panelResolvers) {
      return Promise.reject(
        new Error("Dashboard Panel resolver batching is not configured")
      );
    }
    return this.panelResolvers.request(request, signal);
  }

  diagnostics(): DashboardDataRuntimeDiagnostics {
    return {
      liveConnectionActive: this.stopLiveConnection !== null,
      liveConnectionStarts: this.liveConnectionStarts,
      capabilitySubscriptions: this.capabilities.listenerCount(),
      resolverEntries: this.resolvers.entryCount(),
      resolverBatchesSent:
        this.panelResolvers?.diagnostics().batchesSent ?? 0,
    };
  }

  private applyLiveEvent(event: DashboardLiveEvent): void {
    if (event.type === "hello" && event.states) {
      this.capabilities.applyMany(event.states);
    }
    if (event.type === "capability.updated" && event.state) {
      this.capabilities.apply(event.state);
    }
  }
}
