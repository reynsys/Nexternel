import { MIN_PASSWORD_LENGTH } from "@nexternel/domain";
import { COMMON_PASSWORDS_TEXT } from "./common-passwords.js";

/**
 * Rules for a new password. Without the second check (two-step sign-in) a password has to be strong:
 * at least MIN_PASSWORD_LENGTH characters (packages/domain), not a well-known password (also not one with only numbers or signs
 * added, like "Password1234!"), not the username with numbers added, and not the same few
 * characters over and over.
 */

export { MIN_PASSWORD_LENGTH };

let common: Set<string> | null = null;
function commonPasswords(): Set<string> {
  common ??= new Set(COMMON_PASSWORDS_TEXT.split("\n"));
  return common;
}

const EDGE = /^[\d\W_]+|[\d\W_]+$/g;

/** One rule a new password must meet: shown as a tick while typing, and its message when it fails. */
export type PasswordCheck = { id: "length" | "common" | "username" | "variety"; label: string; ok: boolean; problem: string };

/** Every rule for this password, in the order a person reads them (setup's live ticks use this). */
export function passwordChecks(password: string, username = ""): PasswordCheck[] {
  const lower = password.toLowerCase();
  const core = lower.replace(EDGE, "");
  const list = commonPasswords();
  const name = username.trim().toLowerCase();
  const tooLong = password.length > 200;
  return [
    {
      id: "length",
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      ok: password.length >= MIN_PASSWORD_LENGTH && !tooLong,
      problem: tooLong
        ? "The password is too long (200 characters at most)."
        : `The password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    },
    {
      id: "common",
      label: "Not a well-known password",
      ok: password.length > 0 && !(list.has(lower) || (core.length > 0 && list.has(core))),
      problem: "That password is one of the most common ones. Choose something less easy to guess.",
    },
    {
      id: "username",
      label: "Not too close to your username",
      ok:
        password.length > 0 &&
        !(name.length >= 3 && (core === name || core === "" || (lower.includes(name) && core.replace(name, "").length < 4))),
      problem: "The password is too close to the username.",
    },
    {
      id: "variety",
      label: "Not the same few characters over and over",
      ok: new Set(lower).size >= 5,
      problem: "The password uses too few different characters.",
    },
  ];
}

/** Why this password is not good enough, in plain words; null when it is fine. */
export function passwordProblem(password: string, username = ""): string | null {
  return passwordChecks(password, username).find((c) => !c.ok)?.problem ?? null;
}

/** True when this password meets today's rules (checked at sign-in from outside). */
export function isStrongPassword(password: string, username = ""): boolean {
  return passwordProblem(password, username) === null;
}
