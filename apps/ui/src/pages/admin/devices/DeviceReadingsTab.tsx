import { useState } from "react";
import { Box, Button, Divider, FormControlLabel, IconButton, ListSubheader, Menu, MenuItem, Stack, Switch, Typography } from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import type { Capability, DeviceRecord } from "../../../api";
import { capabilityKindLabel } from "../../../lib/capability-kind-labels";
import { CODE_TEXT, ICON_SIZE } from "../../../lib/appearance/type";
import { ItemIcon } from "../../../lib/icons/ItemIcon";
import { insetSx } from "../../../skins/surfaceStyles";
import { ButtonRow } from "../../../components/ButtonRow";
import type { ReadingToEdit } from "./ReadingSettingsDialog";
import { readingValue, switchWord } from "./device-summary";
import { devicesOutlinedButton } from "./devices-panel-styles";

type Item = {
  key: string;
  kind: "sensor" | "relay";
  id: string;
  capabilityId: string | null;
  name: string;
  originalName: string;
  renamed: boolean;
  icon: string | null;
  iconKind: string;
  kindWord: string;
  unit: string | null;
  value: string;
  topic: string;
  entityId: string | null;
  systemId: string | null;
};

type Props = {
  device: DeviceRecord;
  isAdmin: boolean;
  values: Map<string, Capability>;
  systems: { id: string; label: string }[];
  onEditReading: (reading: ReadingToEdit) => void;
  onRemove: (kind: "sensor" | "relay", deviceId: string, id: string, name: string) => void;
  onSetSystem: (capabilityId: string, systemId: string | null) => void;
};

/**
 * Readings & switches: one row each — its icon, name, what it is, and its live value; Name & icon,
 * and the ⋮ button for the rarer choices (what it is used for, remove). The message address and
 * ESPHome id show only with Show technical details.
 */
export function DeviceReadingsTab({ device, isAdmin, values, systems, onEditReading, onRemove, onSetSystem }: Props) {
  const [technical, setTechnical] = useState(false);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; item: Item } | null>(null);
  const items: Item[] = [
    ...device.relays.map((r) => ({
      key: `r-${r.id}`,
      kind: "relay" as const,
      id: r.id,
      capabilityId: r.capabilityId ?? null,
      name: r.customName ?? r.name,
      originalName: r.name,
      renamed: Boolean(r.customName),
      icon: r.icon ?? null,
      iconKind: "switch",
      kindWord: "Switch",
      unit: null,
      value: switchWord(r.lastState),
      topic: r.mqttStateTopic,
      entityId: r.esphomeEntityId,
      systemId: r.systemId ?? null,
    })),
    ...device.sensors.map((s) => ({
      key: `s-${s.id}`,
      kind: "sensor" as const,
      id: s.id,
      capabilityId: s.capabilityId ?? null,
      name: s.customName ?? s.name,
      originalName: s.name,
      renamed: Boolean(s.customName),
      icon: s.icon ?? null,
      iconKind: s.sensorType,
      kindWord: capabilityKindLabel(s.sensorType),
      unit: s.unit ?? null,
      value: readingValue((s.capabilityId && values.get(s.capabilityId)) || { state: null, unit: s.unit }),
      topic: s.mqttStateTopic,
      entityId: s.esphomeEntityId,
      systemId: s.systemId ?? null,
    })),
  ];
  const readings = items.filter((i) => i.kind === "sensor").length;
  const switches = items.length - readings;
  const what = [readings ? `${readings} reading${readings === 1 ? "" : "s"}` : "", switches ? `${switches} switch${switches === 1 ? "" : "es"}` : ""].filter(Boolean).join(" and ");

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 240 }}>
          {items.length ? `${what} from this device. Names and icons set here are used on every dashboard.` : "No readings or switches yet."}
        </Typography>
        <FormControlLabel control={<Switch checked={technical} onChange={(e) => setTechnical(e.target.checked)} />} label="Show technical details" />
      </Box>

      {items.length ? (
        <Box sx={[insetSx(), { p: 0, overflow: "hidden" }]}>
          {items.map((i, n) => (
            <Box key={i.key}>
              {n ? <Divider /> : null}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.5, flexWrap: { xs: "wrap", sm: "nowrap" } }}>
                <ItemIcon iconId={i.icon} kind={i.iconKind} sx={{ fontSize: ICON_SIZE.picker, color: "primary.main", flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" fontWeight="fontWeightBold" noWrap>
                    {i.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {i.kindWord}
                    {i.renamed ? ` · the device calls it "${i.originalName}"` : ""}
                    {i.systemId ? ` · used for ${systems.find((s) => s.id === i.systemId)?.label ?? "a function"}` : ""}
                  </Typography>
                  {technical ? (
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ fontFamily: CODE_TEXT.fontFamily, wordBreak: "break-all" }}>
                      {i.topic}
                      {i.entityId ? ` · ${i.entityId}` : ""}
                    </Typography>
                  ) : null}
                </Box>
                <Typography variant="h6" sx={{ flexShrink: 0, minWidth: 90, textAlign: "right" }}>
                  {i.value}
                </Typography>
                {isAdmin ? (
                  <ButtonRow direction="row" flexWrap="nowrap" sx={{ flexShrink: 0 }}>
                    <Button
                      {...devicesOutlinedButton}
                      disabled={!i.capabilityId}
                      onClick={() =>
                        i.capabilityId &&
                        onEditReading({
                          capabilityId: i.capabilityId,
                          originalName: i.originalName,
                          customName: i.renamed ? i.name : null,
                          icon: i.icon,
                          kind: i.iconKind,
                          ...(i.kind === "sensor" ? { unit: i.unit } : {}),
                        })
                      }
                    >
                      Name &amp; icon
                    </Button>
                    <IconButton aria-label={`More for ${i.name}`} onClick={(e) => setMenu({ anchor: e.currentTarget, item: i })}>
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </ButtonRow>
                ) : null}
              </Box>
            </Box>
          ))}
        </Box>
      ) : null}

      <Menu open={Boolean(menu)} anchorEl={menu?.anchor} onClose={() => setMenu(null)}>
        {menu && systems.length && menu.item.capabilityId
          ? [
              <ListSubheader key="h">Used for</ListSubheader>,
              ...[{ id: "", label: "Nothing in particular" }, ...systems].map((sys) => (
                <MenuItem
                  key={sys.id || "none"}
                  onClick={() => {
                    onSetSystem(menu.item.capabilityId!, sys.id || null);
                    setMenu(null);
                  }}
                >
                  <Box component="span" sx={{ width: 24, display: "inline-flex" }}>
                    {(menu.item.systemId ?? "") === sys.id ? <CheckRoundedIcon fontSize="small" /> : null}
                  </Box>
                  {sys.label}
                </MenuItem>
              )),
              <Divider key="d" />,
            ]
          : null}
        {menu ? (
          <MenuItem
            sx={{ color: "error.main" }}
            onClick={() => {
              onRemove(menu.item.kind, device.id, menu.item.id, menu.item.name);
              setMenu(null);
            }}
          >
            Remove from Nexternel
          </MenuItem>
        ) : null}
      </Menu>
    </Stack>
  );
}
