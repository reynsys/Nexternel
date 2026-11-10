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

/** Why this password is not good enough, in plain words; null when it is fine. */
export function passwordProblem(password: string, username = ""): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `The password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (password.length > 200) return "The password is too long (200 characters at most).";
  const lower = password.toLowerCase();
  const core = lower.replace(EDGE, "");
  const list = commonPasswords();
  if (list.has(lower) || (core.length > 0 && list.has(core))) {
    return "That password is one of the most common ones. Choose something less easy to guess.";
  }
  const name = username.trim().toLowerCase();
  if (name.length >= 3 && (core === name || core === "" || lower.includes(name) && core.replace(name, "").length < 4)) {
    return "The password is too close to the username.";
  }
  if (new Set(lower).size < 5) {
    return "The password uses too few different characters.";
  }
  return null;
}

/** True when this password meets today's rules (checked at sign-in from outside). */
export function isStrongPassword(password: string, username = ""): boolean {
  return passwordProblem(password, username) === null;
}
