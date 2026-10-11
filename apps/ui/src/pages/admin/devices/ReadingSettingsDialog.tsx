import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../../api";
import { IconPicker } from "../../../components/IconPicker";
import { ItemIcon } from "../../../lib/icons/ItemIcon";

export type ReadingToEdit = {
  capabilityId: string;
  /** The name the device reports. */
  originalName: string;
  customName: string | null;
  icon: string | null;
  kind: string;
};

/**
 * A reading's own name and icon, used everywhere it appears. Device updates never change them;
 * "Use the device's name" goes back to what the device reports.
 */
export function ReadingSettingsDialog({
  reading,
  onClose,
  onSaved,
}: {
  reading: ReadingToEdit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("auto");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reading) return;
    setName(reading.customName ?? reading.originalName);
    setIcon(reading.icon || "auto");
    setError(null);
  }, [reading]);

  async function save() {
    if (!reading) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = name.trim();
      await api.updateCapability(reading.capabilityId, {
        name: trimmed && trimmed !== reading.originalName ? trimmed : null,
        icon,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(reading)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Name &amp; icon</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
            inputProps={{ maxLength: 100 }}
            helperText={`The device calls it “${reading?.originalName ?? ""}”. Your name is kept when the device is updated.`}
          />
          {reading && name.trim() !== reading.originalName && (
            <Button size="small" sx={{ alignSelf: "flex-start" }} onClick={() => setName(reading.originalName)}>
              Use the device's name
            </Button>
          )}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ width: 40 }}>
              Icon
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setPickerOpen(true)}
              startIcon={<ItemIcon iconId={icon} kind={reading?.kind} />}
            >
              {icon === "auto" ? "Automatic" : "Change"}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Used on every dashboard. A panel can still give it its own name or icon in its editor.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy}>
          Save
        </Button>
      </DialogActions>
      <IconPicker
        open={pickerOpen}
        value={icon}
        kind={reading?.kind}
        autoLabel="Automatic"
        onChange={setIcon}
        onClose={() => setPickerOpen(false)}
      />
    </Dialog>
  );
}
