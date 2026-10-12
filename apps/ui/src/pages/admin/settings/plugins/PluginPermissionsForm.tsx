import { useEffect, useState } from "react";
import {
  Autocomplete,
  Box,
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api, type Capability, type PluginGrants, type PluginPermissionKey } from "../../../../api";

const LABELS: Record<PluginPermissionKey, string> = {
  devices: "Add its own devices and readings",
  read: "See your readings and history",
  control: "Switch your devices on or off",
  notify: "Post notifications",
};

/** Sensible starting point when installing: everything asked for, except control. */
export function defaultGrants(requested: Partial<Record<PluginPermissionKey, string>>): PluginGrants {
  return {
    devices: Boolean(requested.devices),
    read: requested.read ? "all" : null,
    control: [],
    notify: Boolean(requested.notify),
  };
}

type Area = { id: string; name: string };

type Props = {
  requested: Partial<Record<PluginPermissionKey, string>>;
  grants: PluginGrants;
  onChange: (grants: PluginGrants) => void;
  /** Hide the device picker for control (on the install screen it is set afterwards). */
  controlPickerLater?: boolean;
};

/** One row per permission the plugin asks for, with the plugin's reason underneath. */
export function PluginPermissionsForm({ requested, grants, onChange, controlPickerLater }: Props) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [switches, setSwitches] = useState<Capability[]>([]);
  const keys = (Object.keys(LABELS) as PluginPermissionKey[]).filter((k) => requested[k]);

  useEffect(() => {
    if (requested.read) void api.rooms().then((r) => setAreas(r.rooms.map((a) => ({ id: a.id, name: a.name })))).catch(() => {});
    if (requested.control && !controlPickerLater) {
      void api
        .capabilities()
        .then((r) => setSwitches(r.capabilities.filter((c) => c.kind === "switch" && c.hasCommand)))
        .catch(() => {});
    }
  }, [requested.read, requested.control, controlPickerLater]);

  if (keys.length === 0) {
    return <Typography color="text.secondary">This plugin does not ask for any permissions.</Typography>;
  }

  return (
    <Stack spacing={1.5}>
      {keys.map((key) => {
        const reason = requested[key];
        const on =
          key === "devices" ? grants.devices
          : key === "notify" ? grants.notify
          : key === "read" ? grants.read !== null
          : grants.control.length > 0;
        return (
          <Box key={key}>
            {key === "control" ? (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {LABELS[key]}
              </Typography>
            ) : (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={on}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (key === "devices") onChange({ ...grants, devices: checked });
                      if (key === "notify") onChange({ ...grants, notify: checked });
                      if (key === "read") onChange({ ...grants, read: checked ? "all" : null });
                    }}
                  />
                }
                label={<Typography variant="body2" sx={{ fontWeight: 600 }}>{LABELS[key]}</Typography>}
              />
            )}
            <Typography variant="body2" color="text.secondary" sx={{ pl: key === "control" ? 0 : 4 }}>
              {reason}
            </Typography>

            {key === "read" && grants.read !== null ? (
              <Box sx={{ pl: 4, pt: 0.5 }}>
                <RadioGroup
                  row
                  value={grants.read === "all" ? "all" : "chosen"}
                  onChange={(e) => onChange({ ...grants, read: e.target.value === "all" ? "all" : [] })}
                >
                  <FormControlLabel value="all" control={<Radio size="small" />} label="All areas" slotProps={{ typography: { variant: "body2" } }} />
                  <FormControlLabel value="chosen" control={<Radio size="small" />} label="Only these areas" slotProps={{ typography: { variant: "body2" } }} />
                </RadioGroup>
                {grants.read !== "all" ? (
                  <Autocomplete
                    multiple
                    size="small"
                    options={areas}
                    getOptionLabel={(a) => a.name}
                    value={areas.filter((a) => (grants.read as string[]).includes(a.id))}
                    onChange={(_, v) => onChange({ ...grants, read: v.map((a) => a.id) })}
                    renderInput={(params) => <TextField {...params} label="Areas it may see" />}
                  />
                ) : null}
              </Box>
            ) : null}

            {key === "control" ? (
              controlPickerLater ? (
                <Typography variant="body2" color="text.secondary" sx={{ pt: 0.5 }}>
                  Off for now. After installing, choose exactly which devices it may switch, under Permissions.
                </Typography>
              ) : (
                <Autocomplete
                  multiple
                  size="small"
                  sx={{ pt: 1 }}
                  options={switches}
                  getOptionLabel={(c) => (c.roomName ? `${c.name} (${c.roomName})` : c.name)}
                  value={switches.filter((c) => grants.control.includes(c.id))}
                  onChange={(_, v) => onChange({ ...grants, control: v.map((c) => c.id) })}
                  renderInput={(params) => (
                    <TextField {...params} label="Devices it may switch" helperText="Leave empty to allow none." />
                  )}
                />
              )
            ) : null}
          </Box>
        );
      })}
    </Stack>
  );
}
