import { Stack, Typography } from "@mui/material";
import { normalizeBellPrefs, type BellPrefs } from "../skins/themePrefs";
import { Segmented } from "./Segmented";

/**
 * One person's notification bell: when it shows and where it sits. Used in Settings → Notifications
 * (your own) and in Users → Edit (an administrator setting it for someone).
 */
export function BellFields({ value, onChange }: { value: BellPrefs | undefined; onChange: (next: BellPrefs) => void }) {
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
        <Typography variant="caption" color="text.secondary">
          {bell.position === "menu-bottom"
            ? "Next to your name at the bottom of the side menu, on every page."
            : bell.position === "top"
              ? "Next to the Dashboard Options cog on dashboards (in the tabs, dock or rail). On other pages it sits at the top of the side menu."
              : "Next to the Nexternel name at the top of the side menu, on every page."}{" "}
          On phones it is always in the top bar.
        </Typography>
      </Stack>
    </Stack>
  );
}
