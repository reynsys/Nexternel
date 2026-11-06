import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { controlStateOf, type ControlFeatures, type ControlState } from "./control-view";

/** How long a "no answer" message stays. */
const ERROR_SHOWN_MS = 10_000;
/** A change made by repeated presses is sent this long after the last press. */
const SEND_AFTER_MS = 900;

/**
 * A device control on a panel. A change shows at once while it is being sent, and goes back to what
 * the device last reported when the device does not confirm it.
 */
export function useDeviceControl(cap: { id: string; hasCommand: boolean; state: { value: unknown } | null; features?: Record<string, unknown> | null }) {
  const [pending, setPending] = useState<ControlState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reported = controlStateOf(cap.state?.value);
  const waiting = useRef<ControlState | null>(null);
  const timer = useRef<number | null>(null);
  const sending = useRef(0);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), ERROR_SHOWN_MS);
    return () => window.clearTimeout(t);
  }, [error]);

  async function send(values: ControlState) {
    const mine = ++sending.current;
    try {
      await api.control(cap.id, values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Command failed");
    } finally {
      // A newer press keeps showing what it asked for.
      if (mine === sending.current && timer.current === null) setPending(null);
    }
  }

  function sendWaiting() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const values = waiting.current;
    waiting.current = null;
    if (values) void send(values);
  }
  const sendWaitingNow = useRef(sendWaiting);
  sendWaitingNow.current = sendWaiting;
  // Closing the panel straight after a press must not lose it.
  useEffect(() => () => sendWaitingNow.current(), []);

  async function change(values: ControlState) {
    if (!cap.hasCommand) return;
    setError(null);
    setPending((p) => ({ ...p, ...values }));
    await send(values);
  }

  /** Change that shows at once and goes to the device once the presses stop: only the final value is sent. */
  function changeSoon(values: ControlState) {
    if (!cap.hasCommand) return;
    setError(null);
    setPending((p) => ({ ...p, ...values }));
    waiting.current = { ...waiting.current, ...values };
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(sendWaiting, SEND_AFTER_MS);
  }

  return {
    state: { ...reported, ...pending },
    features: (cap.features ?? {}) as ControlFeatures,
    error,
    busy: pending !== null,
    change,
    changeSoon,
  };
}
