import type {
  ResolverEnvelope,
  ResolverLoadResult,
} from "./types";

type CacheEntry = {
  generation: number;
  controller: AbortController;
  promise: Promise<ResolverEnvelope<unknown, unknown>>;
  settled: ResolverEnvelope<unknown, unknown> | null;
  consumers: number;
};

export type ResolverRequestOptions = {
  force?: boolean;
};

export type ResolverLease<TData, TContext = unknown> = {
  promise: Promise<ResolverEnvelope<TData, TContext>>;
  release: () => void;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Resolver request failed";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Session resolver cache. Identity is the normalized data request, never the
 * Panel instance id. Concurrent identical requests share one in-flight promise.
 */
export class ResolverCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly listeners = new Map<
    string,
    Set<(envelope: ResolverEnvelope<unknown, unknown>) => void>
  >();
  private nextDataVersion = 1;

  acquire<TData, TContext = unknown>(
    key: string,
    loader: (
      signal: AbortSignal
    ) => Promise<ResolverLoadResult<TData, TContext>>,
    options: ResolverRequestOptions = {}
  ): ResolverLease<TData, TContext> {
    const current = this.entries.get(key);
    if (current && !options.force && current.settled?.status !== "error") {
      current.consumers += 1;
      return this.lease<TData, TContext>(key, current);
    }

    const generation = (current?.generation ?? 0) + 1;
    if (current && options.force) current.controller.abort();

    const controller = new AbortController();
    const entry: CacheEntry = {
      generation,
      controller,
      promise: Promise.resolve(null as never),
      settled: null,
      consumers: 1,
    };

    const promise = loader(controller.signal)
      .then((result): ResolverEnvelope<TData, TContext> => ({
        status: "ready",
        data: result.data,
        context: result.context ?? null,
        subscriptionKeys: result.subscriptionKeys ?? [],
        dataVersion: this.nextDataVersion++,
        error: null,
      }))
      .catch((error): ResolverEnvelope<TData, TContext> => {
        if (isAbortError(error) || controller.signal.aborted) {
          return {
            status: "inactive",
            data: null,
            context: null,
            subscriptionKeys: [],
            dataVersion: 0,
            error: null,
          };
        }
        return {
          status: "error",
          data: null,
          context: null,
          subscriptionKeys: [],
          dataVersion: this.nextDataVersion++,
          error: { message: errorMessage(error) },
        };
      })
      .then((envelope) => {
        const latest = this.entries.get(key);
        if (latest === entry && latest.generation === generation) {
          latest.settled = envelope as ResolverEnvelope<unknown, unknown>;
          for (const listener of this.listeners.get(key) ?? []) {
            listener(envelope as ResolverEnvelope<unknown, unknown>);
          }
        }
        return envelope;
      });

    entry.promise = promise as Promise<ResolverEnvelope<unknown, unknown>>;
    this.entries.set(key, entry);
    return this.lease<TData, TContext>(key, entry);
  }

  peek<TData, TContext = unknown>(
    key: string
  ): ResolverEnvelope<TData, TContext> | null {
    return (
      (this.entries.get(key)?.settled as
        | ResolverEnvelope<TData, TContext>
        | null
        | undefined) ?? null
    );
  }

  subscribe<TData, TContext = unknown>(
    key: string,
    listener: (envelope: ResolverEnvelope<TData, TContext>) => void
  ): () => void {
    const wrapped = listener as (
      envelope: ResolverEnvelope<unknown, unknown>
    ) => void;
    const listeners =
      this.listeners.get(key) ??
      new Set<(envelope: ResolverEnvelope<unknown, unknown>) => void>();
    listeners.add(wrapped);
    this.listeners.set(key, listeners);
    return () => {
      listeners.delete(wrapped);
      if (listeners.size === 0) {
        this.listeners.delete(key);
        const entry = this.entries.get(key);
        if (entry) this.abortIfUnused(key, entry);
      }
    };
  }

  invalidate(key: string): void {
    const entry = this.entries.get(key);
    entry?.controller.abort();
    this.entries.delete(key);
  }

  clear(): void {
    for (const entry of this.entries.values()) entry.controller.abort();
    this.entries.clear();
    this.listeners.clear();
  }

  entryCount(): number {
    return this.entries.size;
  }

  private lease<TData, TContext>(
    key: string,
    entry: CacheEntry
  ): ResolverLease<TData, TContext> {
    let released = false;
    return {
      promise: entry.promise as Promise<ResolverEnvelope<TData, TContext>>,
      release: () => {
        if (released) return;
        released = true;
        entry.consumers = Math.max(0, entry.consumers - 1);
        this.abortIfUnused(key, entry);
      },
    };
  }

  private abortIfUnused(key: string, entry: CacheEntry): void {
    if (
      entry.consumers > 0 ||
      (this.listeners.get(key)?.size ?? 0) > 0
    ) {
      return;
    }
    if (!entry.settled) entry.controller.abort();
    if (!entry.settled || entry.settled.status === "error") {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    }
  }
}

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stableObject(item)])
  );
}

/** Stable key for future resolver categories; array ordering remains semantic. */
export function stableResolverKey(
  resolverKind: string,
  identity: Record<string, unknown>
): string {
  return JSON.stringify({
    resolverKind,
    identity: stableObject(identity),
  });
}
