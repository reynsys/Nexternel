import { Stack } from "@mui/material";
import { AutomaticBackupsSection } from "../sections/AutomaticBackupsSection";
import { BackupRestoreSection } from "../sections/BackupRestoreSection";

/** One place for backups: automatic daily backups, and a one-off backup or restore. */
export function BackupSettingsPage() {
  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <AutomaticBackupsSection />
      <BackupRestoreSection />
    </Stack>
  );
}
