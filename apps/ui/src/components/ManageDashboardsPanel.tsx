import { dashboardPath } from "../lib/dashboard-path";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { api, type DashboardSummary } from "../api";
import { DashboardIconPicker } from "./DashboardIconPicker";
import { getDashboardIcon } from "../lib/dashboard-icons";
import { migratePersistedDashboardDocument } from "../lib/panel-compatibility";
import { ButtonRow } from "./ButtonRow";

type Props = {
  /** Inside Dashboard settings (the page title and intro are not shown). */
  compact?: boolean;
  /** Dashboard currently open on the page (so a rename here reaches the page's Save). */
  currentDashboardId?: string;
  /** Called after create / delete / default / edit so the Dashboard Menu can refresh. */
  onDashboardsChanged?: () => void;
  /** When the open dashboard is edited here, push it into the page's state. */
  onCurrentTabMeta?: (meta: { name: string; tabIcon: string; showTabLabel: boolean }) => void;
};

const square = { minWidth: 32, width: 32, height: 32, p: 0 } as const;

/**
 * Every dashboard on this system: create, open, order in the Dashboard Menu, the one that opens
 * at sign-in (star), edit name and icon, delete. Editing and deleting happen in the dashboard's own
 * row (no pop-up windows). Used in Dashboard settings → All dashboards and on /manage/dashboards.
 */
export function ManageDashboardsPanel({ compact, currentDashboardId, onDashboardsChanged, onCurrentTabMeta }: Props) {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** The row being edited or asked about (one at a time). */
  const [rowMode, setRowMode] = useState<{ id: string; mode: "edit" | "delete" } | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("dashboard");
  const [editShowLabel, setEditShowLabel] = useState(true);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; d: DashboardSummary } | null>(null);

  async function load() {
    try {
      const res = await api.dashboards();
      setDashboards(res.dashboards);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the dashboards");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createDashboard(name.trim() || "New dashboard");
      setName("");
      onDashboardsChanged?.();
      navigate(`/dashboards/${res.dashboard.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the dashboard");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await api.deleteDashboard(id);
      setRowMode(null);
      await load();
      onDashboardsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the dashboard");
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(id: string) {
    try {
      await api.saveDashboard(id, { isDefault: true });
      await load();
      onDashboardsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not choose the sign-in dashboard");
    }
  }

  async function moveDashboard(id: string, dir: -1 | 1) {
    const idx = dashboards.findIndex((d) => d.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= dashboards.length) return;
    const next = [...dashboards];
    const [item] = next.splice(idx, 1);
    next.splice(swap, 0, item);
    setDashboards(next);
    setError(null);
    try {
      const res = await api.reorderDashboards(next.map((d) => d.id));
      setDashboards(res.dashboards);
      onDashboardsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the order");
      await load();
    }
  }

  async function openEdit(d: DashboardSummary) {
    setError(null);
    try {
      const res = await api.getDashboard(d.id);
      const doc = migratePersistedDashboardDocument(res.dashboard.document, res.dashboard.name);
      setEditName(res.dashboard.name || doc.name);
      setEditIcon(doc.tabIcon ?? "dashboard");
      setEditShowLabel(doc.showTabLabel !== false);
      setRowMode({ id: d.id, mode: "edit" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the dashboard");
    }
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
    try {
      const nextName = editName.trim() || "Dashboard";
      const res = await api.getDashboard(id);
      const doc = migratePersistedDashboardDocument(res.dashboard.document, nextName);
      await api.saveDashboard(id, {
        name: nextName,
        document: { ...doc, name: nextName, tabIcon: editIcon, showTabLabel: editShowLabel },
      });
      // The open dashboard's page state takes the change, so its next Save keeps it.
      if (id === currentDashboardId) {
        onCurrentTabMeta?.({ name: nextName, tabIcon: editIcon, showTabLabel: editShowLabel });
      }
      setRowMode(null);
      await load();
      onDashboardsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2}>
      {!compact && <Typography variant="h4">Dashboards</Typography>}
      <Typography variant="body2" color="text.secondary">
        Every dashboard on this system. The arrows set their order in the Dashboard Menu; the star marks
        the one that opens when someone signs in.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {dashboards.length > 0 && !dashboards.some((d) => d.isDefault) && (
        <Alert severity="warning">No sign-in dashboard yet — choose one with its star.</Alert>
      )}

      <Stack spacing={1}>
        {dashboards.map((d, index) => {
          const Icon = getDashboardIcon(d.tabIcon);
          const mode = rowMode?.id === d.id ? rowMode.mode : null;
          return (
            <Paper key={d.id} variant="outlined" sx={{ p: 1, borderRadius: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Icon fontSize="small" color="primary" />
                <Typography noWrap sx={{ flex: 1, minWidth: 0 }} title={d.name}>
                  {d.name}
                  {d.id === currentDashboardId ? (
                    <Typography component="span" variant="caption" color="text.secondary">
                      {" "}
                      · open now
                    </Typography>
                  ) : null}
                </Typography>
                {d.isDefault ? <Chip size="small" label="Sign-in" color="primary" /> : null}
                <ButtonRow direction="row" flexWrap="nowrap" sx={{ flexShrink: 0 }}>
                  <Tooltip title={d.isDefault ? "Opens at sign-in" : "Open this one at sign-in"}>
                    <Button
                      variant={d.isDefault ? "contained" : "outlined"}
                      size="small"
                      aria-label={d.isDefault ? "Opens at sign-in" : `Open ${d.name} at sign-in`}
                      onClick={() => void setDefault(d.id)}
                      sx={square}
                    >
                      {d.isDefault ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                    </Button>
                  </Tooltip>
                  <Tooltip title="Earlier in the Dashboard Menu">
                    <span>
                      <Button variant="outlined" size="small" aria-label={`Move ${d.name} earlier`} disabled={index === 0} onClick={() => void moveDashboard(d.id, -1)} sx={square}>
                        <ArrowUpwardIcon fontSize="small" />
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="Later in the Dashboard Menu">
                    <span>
                      <Button variant="outlined" size="small" aria-label={`Move ${d.name} later`} disabled={index === dashboards.length - 1} onClick={() => void moveDashboard(d.id, 1)} sx={square}>
                        <ArrowDownwardIcon fontSize="small" />
                      </Button>
                    </span>
                  </Tooltip>
                  <Button variant="outlined" size="small" aria-label={`More for ${d.name}`} aria-haspopup="menu" onClick={(e) => setMenu({ anchor: e.currentTarget, d })} sx={square}>
                    <MoreHorizIcon fontSize="small" />
                  </Button>
                </ButtonRow>
              </Stack>

              {mode === "edit" ? (
                <Stack spacing={2} sx={{ mt: 1.5 }}>
                  <TextField label="Name" size="small" fullWidth value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <FormControlLabel
                    control={<Switch checked={editShowLabel} onChange={(e) => setEditShowLabel(e.target.checked)} />}
                    label="Show the name in the Dashboard Menu (off = icon only)"
                  />
                  <DashboardIconPicker dense value={editIcon} onChange={setEditIcon} />
                  <ButtonRow direction="row" justifyContent="flex-end">
                    <Button variant="outlined" onClick={() => setRowMode(null)}>
                      Cancel
                    </Button>
                    <Button variant="contained" disabled={busy} onClick={() => void saveEdit(d.id)}>
                      Save
                    </Button>
                  </ButtonRow>
                </Stack>
              ) : null}

              {mode === "delete" ? (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="body2">
                    Delete “{d.name}” and everything on it? This cannot be undone.
                  </Typography>
                  <ButtonRow direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                    <Button variant="outlined" onClick={() => setRowMode(null)}>
                      Keep it
                    </Button>
                    <Button variant="contained" color="error" disabled={busy} onClick={() => void remove(d.id)}>
                      Delete
                    </Button>
                  </ButtonRow>
                </Box>
              ) : null}
            </Paper>
          );
        })}
        {dashboards.length === 0 && <Typography color="text.secondary">No dashboards yet — create one below.</Typography>}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField size="small" label="New dashboard name" value={name} onChange={(e) => setName(e.target.value)} sx={{ flex: 1 }} />
        <Button variant="contained" disabled={busy} onClick={() => void create()}>
          Create
        </Button>
      </Stack>

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {menu
          ? [
              <MenuItem
                key="open"
                disabled={menu.d.id === currentDashboardId}
                onClick={() => {
                  const d = menu.d;
                  setMenu(null);
                  navigate(dashboardPath(d, dashboards));
                }}
              >
                Open
              </MenuItem>,
              <MenuItem
                key="edit"
                onClick={() => {
                  const d = menu.d;
                  setMenu(null);
                  void openEdit(d);
                }}
              >
                Edit name and icon…
              </MenuItem>,
              <MenuItem
                key="delete"
                sx={{ color: "error.main" }}
                onClick={() => {
                  const d = menu.d;
                  setMenu(null);
                  setRowMode({ id: d.id, mode: "delete" });
                }}
              >
                Delete…
              </MenuItem>,
            ]
          : null}
      </Menu>
    </Stack>
  );
}
