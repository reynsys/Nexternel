import type {
  PanelResolveRequest,
  PanelResolveResult,
} from "../../api";

export type PanelResolveBatchFetch = (
  requests: readonly {
    requestId: string;
    request: PanelResolveRequest;
  }[],
  signal: AbortSignal
) => Promise<
  readonly (
    | { requestId: string; result: PanelResolveResult; error?: never }
    | { requestId: string; result?: never; error: string }
  )[]
>;

type QueuedRequest = {
  id: string;
  request: PanelResolveRequest;
  signal: AbortSignal;
  settled: boolean;
  resolve: (result: PanelResolveResult) => void;
  reject: (error: Error) => void;
  onAbort: () => void;
  batchController?: AbortController;
  batchItems?: readonly QueuedRequest[];
};

/**
 * Coalesces capability-query resolver work queued in the same turn into one API
 * request. The API resolves the batch from one capability/live snapshot.
 */
export class PanelResolverBatcher {
  private queue: QueuedRequest[] = [];
  private scheduled = false;
  private nextId = 1;
  private readonly activeBatches = new Set<AbortController>();
  private batchesSent = 0;
  private readonly fetchBatch: PanelResolveBatchFetch;

  constructor(fetchBatch: PanelResolveBatchFetch) {
    this.fetchBatch = fetchBatch;
  }

  request(
    request: PanelResolveRequest,
    signal: AbortSignal
  ): Promise<PanelResolveResult> {
    if (signal.aborted) {
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    }

    return new Promise<PanelResolveResult>((resolve, reject) => {
      const item: QueuedRequest = {
        id: String(this.nextId++),
        request,
        signal,
        settled: false,
        resolve,
        reject,
        onAbort: () => {
          if (item.settled) return;
          this.rejectItem(item, new DOMException("Aborted", "AbortError"));
          if (item.batchItems?.every((peer) => peer.settled)) {
            item.batchController?.abort();
          }
        },
      };
      signal.addEventListener("abort", item.onAbort, { once: true });
      this.queue.push(item);
      this.scheduleFlush();
    });
  }

  cancelPending(): void {
    for (const controller of this.activeBatches) controller.abort();
    for (const item of this.queue) this.rejectItem(
      item,
      new DOMException("Aborted", "AbortError")
    );
    this.queue = [];
  }

  diagnostics(): { queued: number; activeBatches: number; batchesSent: number } {
    return {
      queued: this.queue.filter((item) => !item.settled).length,
      activeBatches: this.activeBatches.size,
      batchesSent: this.batchesSent,
    };
  }

  private scheduleFlush(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      void this.flush();
    });
  }

  private async flush(): Promise<void> {
    const items = this.queue.filter(
      (item) => !item.settled && !item.signal.aborted
    );
    this.queue = [];
    if (items.length === 0) return;

    const controller = new AbortController();
    this.activeBatches.add(controller);
    this.batchesSent += 1;
    for (const item of items) {
      item.batchController = controller;
      item.batchItems = items;
    }
    try {
      const results = await this.fetchBatch(
        items.map((item) => ({
          requestId: item.id,
          request: item.request,
        })),
        controller.signal
      );
      const byId = new Map(results.map((result) => [result.requestId, result]));
      for (const item of items) {
        if (item.settled) continue;
        const response = byId.get(item.id);
        if (!response) {
          this.rejectItem(item, new Error("Panel resolver batch omitted a result"));
        } else if (response.error) {
          this.rejectItem(item, new Error(response.error));
        } else if (response.result) {
          this.resolveItem(item, response.result);
        }
      }
    } catch (error) {
      for (const item of items) {
        this.rejectItem(
          item,
          error instanceof Error ? error : new Error("Panel resolver batch failed")
        );
      }
    } finally {
      this.activeBatches.delete(controller);
    }
  }

  private resolveItem(item: QueuedRequest, result: PanelResolveResult): void {
    if (item.settled) return;
    item.settled = true;
    item.signal.removeEventListener("abort", item.onAbort);
    item.resolve(result);
  }

  private rejectItem(item: QueuedRequest, error: Error): void {
    if (item.settled) return;
    item.settled = true;
    item.signal.removeEventListener("abort", item.onAbort);
    item.reject(error);
  }
}
