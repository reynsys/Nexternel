/**
 * Messages from Nexternel to a running plugin (a switch was pressed, settings changed).
 * The plugin collects them by asking /plugin-api/events, which waits up to 25 s for one.
 */
export type PluginEvent =
  | { type: "command"; id: string; deviceKey: string; itemKey: string; action: "on" | "off" }
  | { type: "settings-changed" }
  | {
      type: "panel-request";
      id: string;
      panel: string;
      text: string;
      history: { role: "user" | "assistant"; text: string }[];
      user: string;
    };

type Waiter = { resolve: (events: PluginEvent[]) => void; timer: NodeJS.Timeout };

const MAX_QUEUED = 100;
const queues = new Map<string, PluginEvent[]>();
const waiters = new Map<string, Waiter>();

export function pushPluginEvent(pluginId: string, event: PluginEvent): void {
  const waiter = waiters.get(pluginId);
  if (waiter) {
    waiters.delete(pluginId);
    clearTimeout(waiter.timer);
    waiter.resolve([event]);
    return;
  }
  const queue = queues.get(pluginId) ?? [];
  queue.push(event);
  // A plugin that is not listening must not make the server hold ever more messages.
  if (queue.length > MAX_QUEUED) queue.splice(0, queue.length - MAX_QUEUED);
  queues.set(pluginId, queue);
}

export function waitForPluginEvents(pluginId: string, waitMs: number): Promise<PluginEvent[]> {
  const queued = queues.get(pluginId);
  if (queued && queued.length > 0) {
    queues.delete(pluginId);
    return Promise.resolve(queued);
  }
  // One listener per plugin: a newer request replaces an older one.
  const previous = waiters.get(pluginId);
  if (previous) {
    clearTimeout(previous.timer);
    previous.resolve([]);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters.delete(pluginId);
      resolve([]);
    }, waitMs);
    timer.unref?.();
    waiters.set(pluginId, { resolve, timer });
  });
}

export function clearPluginEvents(pluginId: string): void {
  queues.delete(pluginId);
  const waiter = waiters.get(pluginId);
  if (waiter) {
    waiters.delete(pluginId);
    clearTimeout(waiter.timer);
    waiter.resolve([]);
  }
}
