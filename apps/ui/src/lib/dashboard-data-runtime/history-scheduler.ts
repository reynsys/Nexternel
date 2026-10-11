/**
 * Stage-1 history scheduling foundation. It deduplicates identical in-flight
 * work. Cross-request batching, visibility priorities, and rate limiting remain
 * later migrations so Charts/ECharts are not redesigned in this stage.
 */
export class HistoryRequestScheduler {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  run<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const current = this.inFlight.get(key);
    if (current) return current as Promise<T>;

    const request = loader().finally(() => {
      if (this.inFlight.get(key) === request) this.inFlight.delete(key);
    });
    this.inFlight.set(key, request);
    return request;
  }

  pendingCount(): number {
    return this.inFlight.size;
  }
}

export const dashboardHistoryScheduler = new HistoryRequestScheduler();
