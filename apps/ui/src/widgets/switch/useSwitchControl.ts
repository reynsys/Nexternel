import { useEffect, useState } from "react";
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

  async function setOn(next: boolean) {
    if (!cap?.hasCommand || disabled || busy) return;
    const previous = on;
    if (next === previous) return;
    setBusy(true);
    setError(null);
    setPending(next);
    onCapabilityState?.(cap.id, next, "good", new Date().toISOString());
    try {
      const res = await api.command(cap.id, next ? "on" : "off");
      const value = res.value;
      setPending(value);
      onCapabilityState?.(cap.id, value, "good", new Date().toISOString());
    } catch (err) {
      setPending(null);
      onCapabilityState?.(
        cap.id,
        previous,
        cap.state?.quality ?? "unknown",
        cap.state?.updatedAt ?? new Date().toISOString()
      );
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
    const previous = on;
    try {
      setPending(true);
      onCapabilityState?.(cap.id, true, "good", new Date().toISOString());
      await api.command(cap.id, "on");
      await new Promise((resolve) => window.setTimeout(resolve, ms));
      const res = await api.command(cap.id, "off");
      setPending(false);
      onCapabilityState?.(cap.id, res.value, "good", new Date().toISOString());
    } catch (err) {
      setPending(null);
      onCapabilityState?.(
        cap.id,
        previous,
        cap.state?.quality ?? "unknown",
        cap.state?.updatedAt ?? new Date().toISOString()
      );
      setError(err instanceof Error ? err.message : "Command failed");
    } finally {
      setBusy(false);
    }
  }

  return { on, busy, error, canCommand, toggle, setOn, pulse };
}
