import { useEffect, useState } from "react";
import { api } from "../../api";
import { controlStateOf, type ControlFeatures, type ControlState } from "./control-view";

/** How long a "no answer" message stays. */
const ERROR_SHOWN_MS = 10_000;

/**
 * A device control on a panel. A change shows at once while it is being sent, and goes back to what
 * the device last reported when the device does not confirm it.
 */
export function useDeviceControl(cap: { id: string; hasCommand: boolean; state: { value: unknown } | null; features?: Record<string, unknown> | null }) {
  const [pending, setPending] = useState<ControlState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reported = controlStateOf(cap.state?.value);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), ERROR_SHOWN_MS);
    return () => window.clearTimeout(t);
  }, [error]);

  async function change(values: ControlState) {
    if (!cap.hasCommand) return;
    setError(null);
    setPending((p) => ({ ...p, ...values }));
    try {
      await api.control(cap.id, values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Command failed");
    } finally {
      setPending(null);
    }
  }

  return {
    state: { ...reported, ...pending },
    features: (cap.features ?? {}) as ControlFeatures,
    error,
    busy: pending !== null,
    change,
  };
}
