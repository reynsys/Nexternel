import { Card, CardContent, Stack, Typography } from "@mui/material";
import { DevicesWifiExplainer, DevicesWifiForm } from "../../../components/DevicesWifi";

/** Settings → System: Wi-Fi for your devices (first set in the setup wizard, or when adding a board). */
export function DevicesWifiCard({ surfaceSx, canEdit }: { surfaceSx: object; canEdit: boolean }) {
  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Wi-Fi for your devices
        </Typography>
        <Stack spacing={2}>
          <DevicesWifiExplainer />
          <Typography variant="body2" color="text.secondary">
            Boards already running keep the Wi-Fi they have until their next install.
          </Typography>
          <DevicesWifiForm idPrefix="settings-devices-wifi" canEdit={canEdit} />
        </Stack>
      </CardContent>
    </Card>
  );
}
