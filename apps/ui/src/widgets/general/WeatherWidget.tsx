import { PANEL_TEXT } from "../../lib/appearance/type";
import { Box, Stack, Typography } from "@mui/material";
import type { WeatherResponse, WidgetInstance } from "../../api";
import { parseWeatherConfig, widgetTitleOr } from "./config";
import { useDashboardTileChrome } from "../../lib/dashboard-tile-context";
import { panelContentRootSx } from "../../components/DashboardTileBody";
import { useMetricAppearance } from "../../skins/useMetricAppearance";
import { HumidityMark, WeatherIcon, WindMark } from "./WeatherIcon";
import { usePanelPoll } from "../../lib/usePanelPoll";
import { PanelNotice } from "../../components/PanelNotice";
import { usePanelData } from "../../lib/sample-data";

/** Weather type: sized by the tile's width and height (cqi / cqb), so it fits any tile shape. */
const WX_READING = PANEL_TEXT.valueShared;
const WX_ICON = PANEL_TEXT.picture;
const WX_LABEL = PANEL_TEXT.label;

/** Parse Open-Meteo daily `YYYY-MM-DD` as local calendar day (avoid UTC shift). */
function weekdayShort(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) {
    return new Date(isoDate).toLocaleDateString(undefined, { weekday: "short" });
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export function WeatherWidget({ widget }: { widget: WidgetInstance }) {
  const cfg = parseWeatherConfig(widget.config);
  // Every 15 minutes; quickly again after a failure, and when the screen wakes.
  const panelData = usePanelData();
  const { data, error } = usePanelPoll<WeatherResponse>(
    () => panelData.weather(cfg.weatherLat, cfg.weatherLon),
    900_000,
    [cfg.weatherLat, cfg.weatherLon, panelData]
  );

  const { showBodyHeading, showItemContext } = useDashboardTileChrome();
  const { valueSx } = useMetricAppearance();
  const title = showBodyHeading ? widgetTitleOr(widget, "Weather") : null;
  const place =
    showItemContext && cfg.weatherLocation !== "Weather" ? cfg.weatherLocation : null;

  const code = data?.weatherCode ?? 0;
  const todayForecast = data?.forecast?.[0];
  const upcoming = data?.forecast?.slice(1, 6) ?? [];
  const todayMax =
    todayForecast?.tempMax != null ? `${Math.round(todayForecast.tempMax)}°` : null;
  const todayMin =
    todayForecast?.tempMin != null ? `${Math.round(todayForecast.tempMin)}°` : null;

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {title && (
        <Typography variant="subtitle2" color="text.primary" noWrap sx={{ mb: 0.5, flexShrink: 0 }}>
          {title}
        </Typography>
      )}
      {error && <PanelNotice>{error}</PanelNotice>}
      <Box
        sx={panelContentRootSx({
          p: 1,
          // Sizes follow both the width and the height of this box, so nothing outgrows the tile.
          containerType: "size",
          display: "grid",
          gridTemplateRows: place ? "auto minmax(0, 1fr) auto" : "minmax(0, 1fr) auto",
          rowGap: "6px",
          // A short tile drops the small forecast icons first, never the temperatures.
          "@container (max-height: 150px)": { "& .wx-day-icon": { display: "none" } },
          // A tall, narrow tile: today's weather top to bottom (icon, temperature, details), so it fills the tile.
          "@container (orientation: portrait) and (min-height: 260px)": {
            "& .wx-now": { flexDirection: "column", gap: "clamp(6px, 3cqh, 16px)" },
            "& .wx-now-icon": { maxWidth: "none" },
            "& .wx-now-icon svg": { width: "clamp(28px, 22cqi, 64px)", height: "clamp(28px, 22cqi, 64px)" },
            "& .wx-now-temp": { fontSize: PANEL_TEXT.value },
            "& .wx-now-details": { flexDirection: "row", gap: "12px", flexWrap: "wrap", justifyContent: "center" },
          },
        })}
      >
        {place && (
          <Typography noWrap sx={{ fontSize: WX_LABEL, color: "text.secondary", lineHeight: 1.2 }}>
            {place}
          </Typography>
        )}

        {/* Now: icon with its description, the temperature, then today's high / low, humidity and wind. */}
        <Box
          className="wx-now"
          sx={{
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "safe center",
            gap: "clamp(8px, 4cqi, 28px)",
          }}
        >
          <Stack className="wx-now-icon" alignItems="center" spacing={0.25} sx={{ minWidth: 0, maxWidth: "30%" }}>
            <WeatherIcon code={code} size={WX_ICON} />
            {data?.description && (
              <Typography
                color="text.secondary"
                textAlign="center"
                sx={{
                  fontSize: WX_LABEL,
                  lineHeight: 1.15,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {data.description}
              </Typography>
            )}
          </Stack>
          <Typography className="wx-now-temp" sx={{ ...valueSx, fontSize: WX_READING, lineHeight: 1, whiteSpace: "nowrap" }}>
            {data?.temperature !== undefined ? `${Math.round(data.temperature)}°C` : "—"}
          </Typography>
          <Stack className="wx-now-details" spacing={0.25} useFlexGap sx={{ minWidth: 0 }}>
            {(todayMax || todayMin) && (
              <Typography sx={{ fontSize: WX_LABEL, lineHeight: 1.2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {todayMax ?? "—"}
                <Typography component="span" color="text.secondary" sx={{ fontSize: "inherit" }}>
                  {" "}/ {todayMin ?? "—"}
                </Typography>
              </Typography>
            )}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <HumidityMark size={WX_LABEL} />
              <Typography color="text.secondary" sx={{ fontSize: WX_LABEL, lineHeight: 1.2, whiteSpace: "nowrap" }}>
                {data?.humidity ?? "—"}%
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <WindMark size={WX_LABEL} />
              <Typography color="text.secondary" sx={{ fontSize: WX_LABEL, lineHeight: 1.2, whiteSpace: "nowrap" }}>
                {data?.windSpeed != null ? `${Math.round(data.windSpeed)} mph` : "—"}
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Next five days: weekday, icon, high above low — stacked, so a narrow tile never wraps them. */}
        {upcoming.length > 0 && (
          <Box
            sx={{
              pt: "6px",
              borderTop: "1px solid",
              borderColor: "divider",
              display: "grid",
              gridTemplateColumns: `repeat(${upcoming.length}, minmax(0, 1fr))`,
              columnGap: 0.5,
            }}
          >
            {upcoming.map((day) => (
              <Stack key={day.date} alignItems="center" sx={{ minWidth: 0 }}>
                <Typography color="primary.main" noWrap sx={{ fontSize: WX_LABEL, fontWeight: "fontWeightBold", lineHeight: 1.25 }}>
                  {weekdayShort(day.date)}
                </Typography>
                <Box className="wx-day-icon" sx={{ lineHeight: 0, my: "2px" }}>
                  <WeatherIcon code={day.weatherCode} size={WX_LABEL} />
                </Box>
                <Typography sx={{ fontSize: WX_LABEL, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>
                  {day.tempMax != null ? `${Math.round(day.tempMax)}°` : "—"}
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: WX_LABEL, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>
                  {day.tempMin != null ? `${Math.round(day.tempMin)}°` : "—"}
                </Typography>
              </Stack>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
