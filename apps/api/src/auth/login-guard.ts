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

/**
 * Set by Caddy's outside entrance (Nexternel Anywhere) on every request that came in through the
 * door. Those visitors reach home through the home link, which has a Docker address, so the
 * address alone could make them look like home. The mark can only make a request count as
 * outside, never as home, so a visitor sending it themselves gains nothing.
 */
export const ENTRANCE_HEADER = "x-nexternel-entrance";

/** True only for a visitor at home: a home address, and not through the outside entrance. */
export function isFromHome(request: { ip: string; headers: Record<string, string | string[] | undefined> }): boolean {
  if (request.headers[ENTRANCE_HEADER] !== undefined) return false;
  return isHomeAddress(request.ip);
}

/**
 * Cookies for a visitor through the outside entrance are always sent over the padlock only
 * ("Secure"): a phone opening the plain http address on public Wi-Fi must never send its sign-in.
 * At home there is no padlock, so cookies there stay as they are.
 */
export function secureCookieHeader(value: string | string[] | number | undefined): string | string[] | undefined {
  if (value === undefined || typeof value === "number") return undefined;
  const add = (c: string) => (/;\s*secure\b/i.test(c) ? c : `${c}; Secure`);
  return Array.isArray(value) ? value.map(add) : add(value);
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
