/**
 * What opens a backup file. Backups a server makes itself ("Back up now" and the daily ones, named
 * nexternel-auto-… / nexternel-manual-…) are locked with that server's backup key from its
 * emergency kit; a one-off "Create backup" file (nexternel-backup-…) with the password chosen then.
 */
export type BackupSecretKind = "key" | "password" | "either";

export function backupSecretKind(fileName: string | null | undefined): BackupSecretKind {
  const name = (fileName ?? "").trim().toLowerCase();
  if (/^nexternel-(auto|manual)-/.test(name)) return "key";
  if (/^nexternel-backup-/.test(name)) return "password";
  return "either";
}

/** Label and hint for the box that asks for it. */
export function backupSecretField(fileName: string | null | undefined): { label: string; hint: string } {
  switch (backupSecretKind(fileName)) {
    case "key":
      return {
        label: "Backup key",
        hint: "This backup was made by a server. It opens with that server's backup key, from its emergency kit (Settings → System → Automatic backups → Download emergency kit).",
      };
    case "password":
      return { label: "Backup password", hint: "The password chosen when this backup was made." };
    default:
      return {
        label: "Backup password or key",
        hint: "The password chosen when the backup was made — or, for a backup the server made itself, the backup key from its emergency kit.",
      };
  }
}

/** A wrong-password message that says what is actually needed for this file. */
export function backupSecretError(fileName: string | null | undefined, message: string): string {
  if (!/incorrect backup password/i.test(message)) return message;
  switch (backupSecretKind(fileName)) {
    case "key":
      return "That is not this backup's key. Use the backup key from the emergency kit of the server that made it.";
    case "password":
      return "That is not this backup's password. Use the password chosen when the backup was made.";
    default:
      return "That does not open this backup. Use the password chosen when it was made — or, for a backup the server made itself, the backup key from its emergency kit.";
  }
}
