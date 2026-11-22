/**
 * "Online" is believed only when the Shelly itself says something live. Two things are not proof:
 * the "online" the message service replays (kept from before: if the message service restarted while
 * the Shelly was without power, the Shelly's last will "offline" was never sent), and the "online"
 * Nexternel still has written down from before its own restart or from a restored backup.
 * So on every connection to the message service, and on every replayed "online", Nexternel checks:
 * it asks the Shelly to answer, asks once more if it stays quiet, and only a live answer counts.
 * No answer in time = offline. A replayed "offline" is believed as it is.
 */

/** Ask again after this long without an answer (a Wi-Fi hiccup can lose the first question). */
export const SHELLY_ASK_AGAIN_MS = 10_000;
/** No live word from the Shelly this long after Nexternel first asked: it is not there. */
export const SHELLY_ANSWER_MS = 30_000;

export type ShellyPresenceDeps = {
  /** Send the Shelly a status request; false = not connected to the message service right now. */
  ask(prefix: string): boolean;
  /** The Shelly stayed silent: mark its device(s) offline. */
  notThere(prefix: string): void;
  /** Still connected to the message service? (No verdict while Nexternel itself is cut off.) */
  connected(): boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
};

export function createShellyPresenceCheck(deps: ShellyPresenceDeps) {
  const setTimer = deps.setTimer ?? ((fn, ms) => {
    const t = setTimeout(fn, ms);
    t.unref?.();
    return t;
  });
  const clearTimer = deps.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  const pending = new Map<string, unknown[]>();

  function stop(prefix: string) {
    const timers = pending.get(prefix);
    if (!timers) return;
    for (const t of timers) clearTimer(t);
    pending.delete(prefix);
  }

  return {
    /** Ask the Shelly to answer; offline if it stays silent (already checking = nothing new). */
    check(prefix: string) {
      if (pending.has(prefix)) return;
      deps.ask(prefix);
      pending.set(prefix, [
        setTimer(() => {
          if (pending.has(prefix)) deps.ask(prefix);
        }, SHELLY_ASK_AGAIN_MS),
        setTimer(() => {
          if (!pending.has(prefix)) return;
          pending.delete(prefix);
          if (deps.connected()) deps.notThere(prefix);
        }, SHELLY_ANSWER_MS),
      ]);
    },
    /** The Shelly said something live: it is there, the check is over. */
    heardLive(prefix: string) {
      stop(prefix);
    },
    /** The Shelly (or its last will) said offline: nothing left to check. */
    saidOffline(prefix: string) {
      stop(prefix);
    },
    isChecking(prefix: string) {
      return pending.has(prefix);
    },
  };
}
