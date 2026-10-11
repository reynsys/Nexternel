export type CapabilityStateSnapshot = {
  value: unknown;
  quality: string;
  updatedAt: string;
};

export type LiveCapabilityUpdate = CapabilityStateSnapshot & {
  capabilityId: string;
};

export type DashboardLiveEvent = {
  type: string;
  state?: LiveCapabilityUpdate;
  states?: LiveCapabilityUpdate[];
  message?: string;
};

export type PanelActivity =
  | "visible"
  | "hidden"
  | "collapsed"
  | "inactive";

export function panelActivityIsActive(activity: PanelActivity): boolean {
  return activity === "visible";
}

export type ResolverStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "inactive";

export type ResolverError = {
  message: string;
};

/**
 * Common lifecycle wrapper only. Resolver payloads and context stay generic so
 * capability, resource, integration, and trusted plugin resolvers can differ.
 */
export type ResolverEnvelope<TData, TContext = unknown> = {
  status: ResolverStatus;
  data: TData | null;
  context: TContext | null;
  subscriptionKeys: readonly string[];
  dataVersion: number;
  error: ResolverError | null;
};

export type ResolverLoadResult<TData, TContext = unknown> = {
  data: TData;
  context?: TContext | null;
  subscriptionKeys?: readonly string[];
};
