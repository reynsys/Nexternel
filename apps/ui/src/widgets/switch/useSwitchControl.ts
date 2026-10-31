import { useEffect, useState } from "react";

/** How long a "no answer" message stays under a switch. */
const ERROR_SHOWN_MS = 10_000;
import type { Capability } from "../../api";
import { api } from "../../api";

export function useSwitchControl(
  cap: Capability | undefined,
  disabled: boolean,
  onCapabilityState?: (
    capabilityId: string,
    value: unknown,
    quality?: string,
    updatedAt?: string
  ) => void
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<boolean | null>(null);
  const remoteOn = cap?.state?.value === true;
  const on = pending ?? remoteOn;
  const canCommand = Boolean(cap?.hasCommand) && !disabled && !busy;

  useEffect(() => {
    if (pending !== null && remoteOn === pending) {
      setPending(null);
    }
  }, [pending, remoteOn]);

  // The server answers only once the board reported the new position, so a confirmed position is
  // never held longer than it takes the live update to arrive.
  useEffect(() => {
    if (pending === null || busy) return;
    const t = window.setTimeout(() => setPending(null), 5_000);
    return () => window.clearTimeout(t);
  }, [pending, busy]);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), ERROR_SHOWN_MS);
    return () => window.clearTimeout(t);
  }, [error]);

  async function setOn(next: boolean) {
    if (!cap?.hasCommand || disabled || busy) return;
    const previous = on;
    if (next === previous) return;
    setBusy(true);
    setError(null);
    try {
      // Waits for the board's own answer: until then the switch shows "Switching…", not a position.
      const res = await api.command(cap.id, next ? "on" : "off");
      const value = res.value;
      setPending(value);
      onCapabilityState?.(cap.id, value, "good", new Date().toISOString());
    } catch (err) {
      // Back to the position the board last reported.
      setPending(null);
      setError(err instanceof Error ? err.message : "Command failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    void setOn(!on);
  }

  async function pulse(ms: number) {
    if (!cap?.hasCommand || disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.command(cap.id, "on");
      await new Promise((resolve) => window.setTimeout(resolve, ms));
      const res = await api.command(cap.id, "off");
      setPending(false);
      onCapabilityState?.(cap.id, res.value, "good", new Date().toISOString());
    } catch (err) {
      setPending(null);
      setError(err instanceof Error ? err.message : "Command failed");
    } finally {
      setBusy(false);
    }
  }

  /** `busy`: sent, waiting for the board to report the new position. */
  return { on, busy, error, canCommand, toggle, setOn, pulse };
}
