import { useEffect, useRef, useState } from "react";

/** After a failed load, try again soon (doubling up to the normal interval), not a whole interval later. */
const FIRST_RETRY_MS = 15_000;

/**
 * Data a panel fetches on a timer (weather, system information, devices). Keeps the last good
 * data when a fetch fails, retries quickly after a failure, and fetches again as soon as the
 * screen wakes or the network comes back, so a server restart or Wi-Fi blip heals by itself.
 * `error` is a plain sentence, set only while there is no data to show.
 */
export function usePanelPoll<T>(
  load: () => Promise<T>,
  intervalMs: number,
  deps: readonly unknown[] = []
): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let retryMs = FIRST_RETRY_MS;

    async function run() {
      window.clearTimeout(timer);
      let next = intervalMs;
      try {
        const res = await loadRef.current();
        if (cancelled) return;
        setData(res);
        setFailed(null);
        retryMs = FIRST_RETRY_MS;
      } catch (err) {
        if (cancelled) return;
        setFailed(err instanceof Error && err.message ? err.message : "Not available right now");
        next = Math.min(retryMs, intervalMs);
        retryMs = Math.min(retryMs * 2, intervalMs);
      }
      if (!cancelled) timer = window.setTimeout(() => void run(), next);
    }

    const wake = () => {
      if (document.visibilityState === "visible") void run();
    };
    void run();
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);

  return { data, error: data === null ? failed : null };
}
