import { useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import { api } from "../api";
import { migratePersistedDashboardDocument } from "../lib/panel-compatibility";
import { DashboardIconPicker } from "./DashboardIconPicker";

/** A new dashboard from the room menu (tabs, dock, rail): its name and icon, then it opens ready to fill. */
export function NewDashboardDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("dashboard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const finalName = name.trim() || "New dashboard";
      const res = await api.createDashboard(finalName);
      if (icon !== "dashboard") {
        const doc = migratePersistedDashboardDocument(res.dashboard.document, finalName);
        await api.saveDashboard(res.dashboard.id, { name: finalName, document: { ...doc, name: finalName, tabIcon: icon } });
      }
      setName("");
      setIcon("dashboard");
      onCreated(res.dashboard.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <DialogTitle>Add dashboard</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Name"
            placeholder="e.g. Garden"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 1 }}
          />
          <Box sx={{ mt: 2 }}>
            <DashboardIconPicker dense value={icon} onChange={setIcon} />
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
            It opens ready to add panels. Drag it in the Dashboard Menu to change its place; its name and icon can be changed in
            Dashboard settings.
          </Typography>
          {error ? <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
