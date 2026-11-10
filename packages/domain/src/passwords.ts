/**
 * Password lengths, shared by the server (which enforces them) and the screens (which explain them),
 * so a hint can never say something different from the rule.
 */

/** A person's sign-in password (apps/api/src/auth/password-rules.ts has the other rules). */
export const MIN_PASSWORD_LENGTH = 12;

/** The password that locks a backup file. */
export const MIN_BACKUP_PASSWORD_LENGTH = 8;
