import { Box, Switch, Typography } from "@mui/material";
import { PanelTile } from "../../components/PanelTile";
import { StatusLight } from "../../components/status-light/StatusLight";
import { useDashboardTileChrome } from "../../lib/dashboard-tile-context";
import { ItemIcon } from "../../lib/icons/ItemIcon";
import { resolveItemHeading } from "../../lib/panel-item-display";
import { useSwitchControl } from "../../widgets/switch/useSwitchControl";
import { useMetricAppearance } from "../../skins/useMetricAppearance";
import { itemNameSx } from "../PanelItemChrome";
import { asSwitchCapability } from "../panel-capabilities";
import { parseCapabilityReading } from "../parse-capability-reading";
import type { SemanticCapabilityView } from "./types";

const ROW_MIN_HEIGHT_PX = 36;

function RowShell({ item, children }: { item: SemanticCapabilityView; children: React.ReactNode }) {
  const { titleTile, itemDisplay } = useDashboardTileChrome();
  const { name, iconId } = resolveItemHeading({
    itemId: item.source.id,
    title: item.label,
    readingIcon: "icon" in item.source ? item.source.icon : null,
    prefix: titleTile?.itemPrefix ?? null,
    display: itemDisplay,
  });
  return (
    <Box
      role="group"
      aria-label={name ?? item.label}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        minHeight: ROW_MIN_HEIGHT_PX,
        px: "10px",
        "& + &": { borderTop: "1px solid", borderColor: "divider" },
      }}
    >
      {iconId !== null ? (
        <ItemIcon iconId={iconId} kind={item.source.kind} sx={{ fontSize: 18, color: "primary.main", flexShrink: 0 }} />
      ) : null}
      <Box component="p" title={name ?? undefined} sx={{ ...itemNameSx, flex: 1 }}>
        {name}
      </Box>
      {children}
    </Box>
  );
}

function ReadingRow({ item }: { item: SemanticCapabilityView }) {
  const { valueColor } = useMetricAppearance();
  const { value, unit } = parseCapabilityReading(item.source);
  // A row has no tile of its own, so its light always sits at the end of the row. A panel with
  // one reading already shows its light in the title.
  const { statusLook, titleTile } = useDashboardTileChrome();
  const look = titleTile?.item
    ? null
    : statusLook?.style === "glow"
      ? { ...statusLook, style: "pill" as const }
      : statusLook;
  return (
    <RowShell item={item}>
      <Typography
        component="span"
        sx={{
          flexShrink: 0,
          fontWeight: 700,
          fontSize: "0.95rem",
          fontVariantNumeric: "tabular-nums",
          color: valueColor ?? "text.primary",
          whiteSpace: "nowrap",
        }}
      >
        {value}
        {unit ? (
          <Typography component="span" sx={{ ml: "4px", fontSize: "0.75rem", fontWeight: 600, color: "text.secondary" }}>
            {unit}
          </Typography>
        ) : null}
      </Typography>
      {look && look.style !== "off" ? (
        <StatusLight capabilityId={item.source.id} kind={item.source.kind} unit={item.source.unit} look={look} placement="inline" />
      ) : null}
    </RowShell>
  );
}

function ControlRow({ item }: { item: SemanticCapabilityView }) {
  const cap = item.source;
  const { on, busy, toggle } = useSwitchControl(asSwitchCapability(cap), false);
  return (
    <RowShell item={item}>
      <Switch
        size="small"
        checked={on}
        disabled={busy || !cap.hasCommand}
        onChange={() => toggle()}
        inputProps={{ "aria-label": `${item.label} switch` }}
      />
    </RowShell>
  );
}

/** Several readings or switches as rows in one tile — used when tiles would not fit. */
export function SemanticCapabilityList({ items }: { items: SemanticCapabilityView[] }) {
  return (
    <PanelTile sx={{ overflowY: "auto", py: "4px" }}>
      {/* Centred while it fits; scrolls from the first row when it does not. */}
      <Box sx={{ my: "auto" }}>
        {items.map((item) =>
          item.presentationClass === "control" ? (
            <ControlRow key={item.id} item={item} />
          ) : (
            <ReadingRow key={item.id} item={item} />
          )
        )}
      </Box>
    </PanelTile>
  );
}
