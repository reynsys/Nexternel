/**
 * "On" presses the board did not answer in time. The person was told the press was cancelled, but the
 * board may have got it and only its reply was held up: it then reports "on" later, unseen. That must
 * not stand (a pump or lights running with nobody knowing), so such a report means "switch it back".
 * Only "on": a late "off" is left alone, because switching back would start something again.
 */
export const UNANSWERED_PRESS_MS = 20 * 60_000;

export class UnansweredPresses {
  private presses = new Map<string, number>();

  note(capabilityId: string, now: number): void {
    this.presses.set(capabilityId, now);
  }

  /** A newer press replaces it: what the person asks for now is what counts. */
  clear(capabilityId: string): void {
    this.presses.delete(capabilityId);
  }

  /** The board reported this position: true (once) when it has to be switched back. */
  takeLateOn(capabilityId: string, value: boolean, now: number): boolean {
    const at = this.presses.get(capabilityId);
    if (at === undefined) return false;
    if (now - at > UNANSWERED_PRESS_MS) {
      this.presses.delete(capabilityId);
      return false;
    }
    if (!value) return false;
    this.presses.delete(capabilityId);
    return true;
  }
}
