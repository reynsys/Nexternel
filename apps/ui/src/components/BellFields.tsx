import { Stack, Typography } from "@mui/material";
import { normalizeBellPrefs, type BellPrefs } from "../skins/themePrefs";
import { Segmented } from "./Segmented";

/**
 * One person's notification bell: when it shows and where it sits. Used in Settings → Notifications
 * (your own) and in Users → Edit (an administrator setting it for someone).
 */
export function BellFields({
  value,
  onChange,
  showPlace = true,
}: {
  value: BellPrefs | undefined;
  onChange: (next: BellPrefs) => void;
  /** "Where it sits" (side menu or dashboard tools): left out on a phone, where the bell is always in the top bar. */
  showPlace?: boolean;
}) {
  const bell = normalizeBellPrefs(value);
  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.75}>
        <Typography variant="body2" fontWeight="fontWeightBold">
          When the bell shows
        </Typography>
        <Segmented<BellPrefs["show"]>
          label="When the bell shows"
          value={bell.show}
          options={[
            { value: "always", label: "Always" },
            { value: "new", label: "Only with new messages" },
            { value: "never", label: "Never" },
          ]}
          onChange={(show) => onChange({ ...bell, show })}
        />
      </Stack>
      {showPlace ? (
      <Stack spacing={0.75}>
        <Typography variant="body2" fontWeight="fontWeightBold">
          Where it sits
        </Typography>
        <Segmented<BellPrefs["position"]>
          label="Where the bell sits"
          value={bell.position}
          disabled={bell.show === "never"}
          options={[
            { value: "menu", label: "Top of the side menu" },
            { value: "menu-bottom", label: "Bottom of the side menu" },
            { value: "top", label: "With the dashboard tools" },
          ]}
          onChange={(position) => onChange({ ...bell, position })}
        />
      </Stack>
      ) : null}
    </Stack>
  );
}
