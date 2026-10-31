import { useEffect, useState } from "react";
import { api, type Capability } from "../../../api";
import { useLiveChanges } from "../../../lib/live-changes";

/**
 * Every reading's and switch's current value, for the Devices page (its list summaries and each
 * device's readings). Kept fresh every 20 seconds and when devices or readings change.
 */
export function useCapabilityValues(): Map<string, Capability> {
  const [values, setValues] = useState<Map<string, Capability>>(new Map());
  const [tick, setTick] = useState(0);
  useLiveChanges(["capabilities", "devices"], () => setTick((t) => t + 1));
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .capabilities()
        .then((r) => !cancelled && setValues(new Map(r.capabilities.map((c) => [c.id, c]))))
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tick]);
  return values;
}
