import { isIP } from "net";

/**
 * Slows down password guessing. Pure rules with a clock passed in, so they can be tested.
 *
 * - Per address: the first few wrong passwords are free; after that each try has to wait, and the
 *   wait doubles (30 s, 1 min, 2 min … up to 15 min). A right password clears it.
 *
 * Wrong names count the same as wrong passwords, so guessing names gives nothing away.
 * Accounts are also locked from outside after a few wrong passwords: see outside-lock.ts.
 */

export const FREE_TRIES = 5;
const FIRST_WAIT_MS = 30_000;
const MAX_WAIT_MS = 15 * 60_000;
/** Forget an address or name after this long without wrong passwords. */
const FORGET_MS = 60 * 60_000;
/** Keep memory bounded when many addresses try. */
const MAX_ENTRIES = 10_000;

export type GuardDecision = { ok: true } | { ok: false; retryAfterMs: number };

type AddressEntry = { fails: number; waitUntil: number; last: number };

/** True for this server, the home network and Docker's own networks. */
export function isHomeAddress(ip: string): boolean {
  let a = ip.trim().toLowerCase();
  if (a.startsWith("::ffff:")) a = a.slice(7);
  const kind = isIP(a);
  if (kind === 4) {
    const [p, q] = a.split(".").map(Number);
    return (
      p === 10 ||
      p === 127 ||
      (p === 172 && q >= 16 && q <= 31) ||
      (p === 192 && q === 168) ||
      (p === 169 && q === 254) ||
      (p === 100 && q >= 64 && q <= 127)
    );
  }
  if (kind === 6) {
    return a === "::1" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80");
  }
  return false;
}

function trim<T extends { last: number }>(map: Map<string, T>, now: number) {
  for (const [k, v] of map) if (now - v.last > FORGET_MS) map.delete(k);
  while (map.size > MAX_ENTRIES) {
    const first = map.keys().next().value;
    if (first === undefined) break;
    map.delete(first);
  }
}

export class LoginGuard {
  private addresses = new Map<string, AddressEntry>();

  constructor(private now: () => number = Date.now) {}

  /** May this address try to sign in right now? */
  check(ip: string): GuardDecision {
    const t = this.now();
    const addr = this.addresses.get(ip);
    const wait = addr && addr.waitUntil > t ? addr.waitUntil - t : 0;
    return wait > 0 ? { ok: false, retryAfterMs: wait } : { ok: true };
  }

  /** A wrong name or password from this address. */
  fail(ip: string): void {
    const t = this.now();
    trim(this.addresses, t);

    const addr = this.addresses.get(ip) ?? { fails: 0, waitUntil: 0, last: t };
    addr.fails += 1;
    addr.last = t;
    if (addr.fails >= FREE_TRIES) {
      const steps = addr.fails - FREE_TRIES;
      addr.waitUntil = t + Math.min(FIRST_WAIT_MS * 2 ** steps, MAX_WAIT_MS);
    }
    this.addresses.delete(ip);
    this.addresses.set(ip, addr);

  }

  /** A right password: this address starts fresh. */
  succeed(ip: string): void {
    this.addresses.delete(ip);
  }
}

/** "30 seconds", "2 minutes": how long to wait, rounded up, for messages on screen. */
export function waitText(ms: number): string {
  if (ms < 60_000) {
    const s = Math.max(1, Math.ceil(ms / 1000));
    return `${s} second${s === 1 ? "" : "s"}`;
  }
  const m = Math.ceil(ms / 60_000);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

export const loginGuard = new LoginGuard();
