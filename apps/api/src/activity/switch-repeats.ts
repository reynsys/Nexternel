/**
 * A switch the board turns on and off by itself, again and again (e.g. a sensor that measures in
 * turns), would fill the Activity log. Once it changes by itself more than BUSY_COUNT times within
 * BUSY_WINDOW, its changes are counted instead of written, and one line a SUMMARY_EVERY tells how
 * often it switched. A quiet BUSY_WINDOW ends that, and each change is written again.
 * Changes made from Nexternel are always written (they are not counted here).
 */
export const BUSY_COUNT = 4;
export const BUSY_WINDOW = 10 * 60_000;
export const SUMMARY_EVERY = 60 * 60_000;

export type RepeatVerdict =
  /** Write this change as usual. */
  | { kind: "write" }
  /** It has just become busy: write that from now on there is a summary instead. */
  | { kind: "busy" }
  /** Busy: counted, nothing to write now. */
  | { kind: "quiet" }
  /** Busy and a summary is due: `count` changes since the last line. */
  | { kind: "summary"; count: number; minutes: number };

type State = { recent: number[]; busySince: number | null; lastLine: number; counted: number };

export class SwitchRepeats {
  private states = new Map<string, State>();

  /** A switch changed by itself at `now`: what to write. */
  note(capabilityId: string, now: number): RepeatVerdict {
    const s = this.states.get(capabilityId) ?? { recent: [], busySince: null, lastLine: 0, counted: 0 };
    this.states.set(capabilityId, s);
    const last = s.recent[s.recent.length - 1];
    // Quiet for a whole window: back to writing each change.
    if (s.busySince !== null && last !== undefined && now - last > BUSY_WINDOW) {
      s.busySince = null;
      s.counted = 0;
    }
    s.recent = s.recent.filter((t) => now - t <= BUSY_WINDOW);
    s.recent.push(now);
    if (s.busySince === null) {
      if (s.recent.length <= BUSY_COUNT) return { kind: "write" };
      s.busySince = now;
      s.lastLine = now;
      s.counted = 0;
      return { kind: "busy" };
    }
    s.counted += 1;
    if (now - s.lastLine < SUMMARY_EVERY) return { kind: "quiet" };
    const verdict: RepeatVerdict = { kind: "summary", count: s.counted, minutes: Math.round((now - s.lastLine) / 60_000) };
    s.lastLine = now;
    s.counted = 0;
    return verdict;
  }
}
