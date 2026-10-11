import type {
  CapabilityStateSnapshot,
  LiveCapabilityUpdate,
} from "./types";

type Listener = () => void;

function sameState(
  a: CapabilityStateSnapshot | null | undefined,
  b: CapabilityStateSnapshot | null | undefined
): boolean {
  return (
    a?.value === b?.value &&
    a?.quality === b?.quality &&
    a?.updatedAt === b?.updatedAt
  );
}

function isOlder(
  incoming: CapabilityStateSnapshot,
  current: CapabilityStateSnapshot
): boolean {
  const incomingTime = Date.parse(incoming.updatedAt);
  const currentTime = Date.parse(current.updatedAt);
  if (Number.isFinite(incomingTime) && Number.isFinite(currentTime)) {
    return incomingTime < currentTime;
  }
  return incoming.updatedAt < current.updatedAt;
}

export function canonicalCapabilityIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

/**
 * Normalized live-state store. Listeners register by capability id, so an
 * unrelated update does not notify or rerender the consumer.
 */
export class CapabilityStateStore {
  private readonly states = new Map<string, CapabilityStateSnapshot>();
  private readonly revisions = new Map<string, number>();
  private readonly listeners = new Map<string, Set<Listener>>();

  seed(
    capabilities: readonly {
      id: string;
      state: CapabilityStateSnapshot | null;
    }[]
  ): void {
    for (const capability of capabilities) {
      if (!capability.id || !capability.state) continue;
      const current = this.states.get(capability.id);
      if (current && isOlder(capability.state, current)) continue;
      this.setState(capability.id, capability.state);
    }
  }

  apply(update: LiveCapabilityUpdate): void {
    this.setState(update.capabilityId, {
      value: update.value,
      quality: update.quality,
      updatedAt: update.updatedAt,
    });
  }

  applyMany(updates: readonly LiveCapabilityUpdate[]): void {
    for (const update of updates) this.apply(update);
  }

  get(capabilityId: string): CapabilityStateSnapshot | null {
    return this.states.get(capabilityId) ?? null;
  }

  revision(ids: readonly string[]): string {
    return canonicalCapabilityIds(ids)
      .map((id) => `${id}:${this.revisions.get(id) ?? 0}`)
      .join("|");
  }

  subscribe(ids: readonly string[], listener: Listener): () => void {
    const normalized = canonicalCapabilityIds(ids);
    for (const id of normalized) {
      const set = this.listeners.get(id) ?? new Set<Listener>();
      set.add(listener);
      this.listeners.set(id, set);
    }

    return () => {
      for (const id of normalized) {
        const set = this.listeners.get(id);
        if (!set) continue;
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(id);
      }
    };
  }

  listenerCount(): number {
    let count = 0;
    for (const listeners of this.listeners.values()) count += listeners.size;
    return count;
  }

  private setState(
    capabilityId: string,
    state: CapabilityStateSnapshot
  ): void {
    const current = this.states.get(capabilityId);
    if (
      !capabilityId ||
      (current && (sameState(current, state) || isOlder(state, current)))
    ) {
      return;
    }
    this.states.set(capabilityId, state);
    this.revisions.set(
      capabilityId,
      (this.revisions.get(capabilityId) ?? 0) + 1
    );
    for (const listener of this.listeners.get(capabilityId) ?? []) listener();
  }
}
