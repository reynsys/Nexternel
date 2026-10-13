import type { StatusLightSettings, StatusState } from "@nexternel/domain";

/** One reading's status light, as the server works it out (see api capabilities/status-lights.ts). */
export type CapabilityStatus = {
  capabilityId: string;
  /** null = this reading has no light. */
  state: StatusState | null;
  since: string | null;
  settings: StatusLightSettings | null;
  custom: boolean;
};

type Listener = () => void;

/** Status lights by reading; listeners register by reading id like the live state store. */
export class StatusLightStore {
  private readonly statuses = new Map<string, CapabilityStatus>();
  private readonly listeners = new Map<string, Set<Listener>>();

  set(status: CapabilityStatus): void {
    if (!status?.capabilityId) return;
    this.statuses.set(status.capabilityId, status);
    for (const listener of this.listeners.get(status.capabilityId) ?? []) listener();
  }

  setMany(statuses: readonly CapabilityStatus[]): void {
    for (const s of statuses) this.set(s);
  }

  /** Seed from the readings list without overwriting fresher live news. */
  seed(statuses: readonly (CapabilityStatus | null | undefined)[]): void {
    for (const s of statuses) if (s && !this.statuses.has(s.capabilityId)) this.set(s);
  }

  get(capabilityId: string): CapabilityStatus | null {
    return this.statuses.get(capabilityId) ?? null;
  }

  subscribe(capabilityId: string, listener: Listener): () => void {
    const set = this.listeners.get(capabilityId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(capabilityId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(capabilityId);
    };
  }
}
