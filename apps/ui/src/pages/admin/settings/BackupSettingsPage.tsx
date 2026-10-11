import { Stack } from "@mui/material";
import { AutomaticBackupsSection } from "../sections/AutomaticBackupsSection";
import { BackupRestoreSection } from "../sections/BackupRestoreSection";
import { DeviceFilesPackCard } from "../sections/DeviceFilesPackCard";

/** One place for backups: automatic daily backups, a one-off backup or restore, and device files. */
export function BackupSettingsPage() {
  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <AutomaticBackupsSection />
      <BackupRestoreSection />
      <DeviceFilesPackCard />
    </Stack>
  );
}
