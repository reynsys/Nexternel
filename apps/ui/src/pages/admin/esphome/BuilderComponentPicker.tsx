import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SearchIcon from "@mui/icons-material/Search";
import {
  BUILDER_COMPONENT_GROUP_LABELS,
  BUILDER_CONNECTION_LABELS,
  builderCatalogConnectionsInList,
  builderCatalogGroupsForPlatform,
  filterBuilderCatalog,
  type BuilderComponentGroup,
  type BuilderComponentKind,
  type BuilderConnectionType,
  type EsphomePlatform,
} from "@nexternel/domain";

type Props = {
  platform: EsphomePlatform;
  onPick: (kind: BuilderComponentKind) => void;
  onBrowseImport?: () => void;
  disabled?: boolean;
};

type ConnectionFilter = BuilderConnectionType | "all";

export function BuilderComponentPicker({
  platform,
  onPick,
  onBrowseImport,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<BuilderComponentGroup | null>(null);
  const [connection, setConnection] = useState<ConnectionFilter>("all");

  const groups = useMemo(() => builderCatalogGroupsForPlatform(platform), [platform]);

  const searchActive = query.trim().length > 0;
  const browseMode = searchActive || group !== null;

  const groupBaseList = useMemo(
    () =>
      filterBuilderCatalog({
        platform,
        group,
        connection: "all",
      }),
    [platform, group]
  );

  const filtered = useMemo(
    () =>
      filterBuilderCatalog({
        platform,
        query,
        group: searchActive ? null : group,
        connection: browseMode ? connection : "all",
      }),
    [platform, query, group, connection, searchActive, browseMode]
  );

  const connectionOptions = useMemo(
    () => builderCatalogConnectionsInList(groupBaseList),
    [groupBaseList]
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setGroup(null);
    setConnection("all");
  }, [open]);

  useEffect(() => {
    if (connection !== "all" && !connectionOptions.includes(connection)) {
      setConnection("all");
    }
  }, [connection, connectionOptions]);

  function close() {
    setOpen(false);
  }

  function pick(kind: BuilderComponentKind) {
    onPick(kind);
    close();
  }

  function openGroup(next: BuilderComponentGroup) {
    setGroup(next);
    setConnection("all");
    setQuery("");
  }

  function backToGroups() {
    setGroup(null);
    setConnection("all");
    setQuery("");
  }

  const title = searchActive
    ? "Search components"
    : group
      ? BUILDER_COMPONENT_GROUP_LABELS[group]
      : "Add component";

  return (
    <>
      <Button
        startIcon={<AddIcon />}
        variant="outlined"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Add component
      </Button>

      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {group && !searchActive && (
              <Button
                size="small"
                startIcon={<ArrowBackIcon />}
                onClick={backToGroups}
                sx={{ mr: 0.5, minWidth: 0 }}
              >
                Back
              </Button>
            )}
            <span>{title}</span>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search sensors and actuators…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {browseMode && connectionOptions.length > 1 && (
            <Stack
              direction="row"
              spacing={0.75}
              flexWrap="wrap"
              useFlexGap
              sx={{ px: 2, pb: 1.5 }}
            >
              <Chip
                size="small"
                label="All wiring"
                variant={connection === "all" ? "filled" : "outlined"}
                color={connection === "all" ? "primary" : "default"}
                onClick={() => setConnection("all")}
              />
              {connectionOptions.map((conn) => (
                <Chip
                  key={conn}
                  size="small"
                  label={BUILDER_CONNECTION_LABELS[conn]}
                  variant={connection === conn ? "filled" : "outlined"}
                  color={connection === conn ? "primary" : "default"}
                  onClick={() => setConnection(conn)}
                />
              ))}
            </Stack>
          )}

          {!searchActive && !group && (
            <List dense disablePadding>
              {groups.map((row) => (
                <ListItemButton key={row.group} onClick={() => openGroup(row.group)}>
                  <ListItemText
                    primary={row.label}
                    secondary={`${row.description} · ${row.count} type${row.count === 1 ? "" : "s"}`}
                    primaryTypographyProps={{ fontWeight: "fontWeightBold" }}
                  />
                  <ChevronRightIcon fontSize="small" color="action" />
                </ListItemButton>
              ))}
            </List>
          )}

          {browseMode && (
            <List dense disablePadding sx={{ maxHeight: 320, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <Box sx={{ px: 2, py: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    No components match your search or filter.
                  </Typography>
                </Box>
              ) : (
                filtered.map((entry) => (
                  <ListItemButton key={entry.id} onClick={() => pick(entry.id)}>
                    <ListItemText
                      primary={entry.label}
                      secondary={
                        <>
                          {entry.description}
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mt: 0.25 }}
                          >
                            {BUILDER_CONNECTION_LABELS[entry.connectionType]} wiring
                          </Typography>
                        </>
                      }
                      primaryTypographyProps={{ variant: "body2", fontWeight: "fontWeightMedium" }}
                    />
                  </ListItemButton>
                ))
              )}
            </List>
          )}

          <Divider />

          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Don&apos;t see your sensor?{" "}
              {onBrowseImport ? (
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={() => {
                    close();
                    onBrowseImport();
                  }}
                  sx={{ verticalAlign: "baseline" }}
                >
                  Import existing ESPHome YAML
                </Link>
              ) : (
                "Use Import existing configuration on the previous screen"
              )}
              , or create the device and edit YAML under Devices → ESPHome → Advanced.
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={close}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
