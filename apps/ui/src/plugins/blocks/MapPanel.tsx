import { useEffect, useMemo, useRef, useState } from "react";
import { Box, IconButton, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import L from "leaflet";
import { createMap, mapSx } from "./map-base";
import { usePanelContent } from "./use-panel-content";
import { mapIsDark, parseMapContent, timeAgo, type MapMarker } from "../../lib/map-panel-content";

/** How often the "minutes ago" text moves on (new positions arrive by themselves). */
const CLOCK_MS = 30_000;
const CLOSE_ZOOM = 15;
/** Plugins resend at least every 5 minutes, so anything older means the plugin has stopped. */
const STOPPED_MS = 10 * 60_000;

/** The route line on the map (see MapPanel). */
const ROUTE_COLOUR = "#ff2bd6";

function markerIcon(color: string, heading: number | null): L.DivIcon {
  const arrow =
    heading === null
      ? ""
      : `<div style="position:absolute;left:5px;top:-5px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:9px solid ${color};transform-origin:7px 16px;transform:rotate(${heading}deg)"></div>`;
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div style="position:relative;width:24px;height:24px">${arrow}<div style="position:absolute;inset:3px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5)"></div></div>`,
  });
}

function sameMarkers(a: MapMarker[], b: MapMarker[]): boolean {
  return a.length === b.length && a.every((m, i) => m.id === b[i].id && m.lat === b[i].lat && m.lon === b[i].lon);
}

/** Map building block for plugin panels: shows the places and the trail the plugin last wrote. */
export function MapPanel({ pluginId, panelId }: { pluginId: string; panelId: string }) {
  const theme = useTheme();
  const movingColor = theme.palette.success.main;
  const parkedColor = theme.palette.error.main;
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const following = useRef(true);
  const shown = useRef<MapMarker[]>([]);
  const { content: saved, loaded } = usePanelContent(pluginId, panelId);
  const [wandered, setWandered] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // "2 min ago" and the stopped-extension warning count on between updates.
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, [saved]);

  const content = useMemo(() => parseMapContent(saved?.body ?? ""), [saved?.body]);
  const dark = mapIsDark(content.look, theme.palette.mode === "dark");
  // The route has its own colour, not the account's: map roads are orange, yellow and pink, water
  // blue and parks green, so a route in an orange or blue Look disappears into them. Magenta is
  // not used by the map; an outline (dark on a dark map, white on a light one) keeps it clear.
  const color = ROUTE_COLOUR;
  const casing = dark ? "#000000" : "#ffffff";
  const hasPlaces = content.markers.length > 0;

  const centre = (m: L.Map, markers: MapMarker[]) => {
    // Close in the first time; after that the zoom stays where the person put it.
    if (markers.length === 1) m.setView([markers[0].lat, markers[0].lon], shown.current.length ? m.getZoom() : CLOSE_ZOOM);
    else if (markers.length > 1) {
      m.fitBounds(L.latLngBounds(markers.map((p) => [p.lat, p.lon] as [number, number])), { padding: [40, 40] });
    }
  };

  useEffect(() => {
    if (!hasPlaces || !holder.current || map.current) return;
    const m = createMap(holder.current);
    layers.current = L.layerGroup().addTo(m);
    // Moving the map by hand stops it following until the location button is pressed.
    m.on("dragstart", () => {
      following.current = false;
      setWandered(true);
    });
    map.current = m;
    const sizeWatch = new ResizeObserver(() => m.invalidateSize());
    sizeWatch.observe(holder.current);
    return () => {
      sizeWatch.disconnect();
      m.remove();
      map.current = null;
      layers.current = null;
      shown.current = [];
    };
  }, [hasPlaces]);

  useEffect(() => {
    const m = map.current;
    const group = layers.current;
    if (!m || !group) return;
    group.clearLayers();
    if (content.trail.length > 1) {
      L.polyline(content.trail, { color: casing, weight: 7, opacity: 0.6, lineJoin: "round", lineCap: "round" }).addTo(group);
      L.polyline(content.trail, { color, weight: 4, opacity: 0.95, lineJoin: "round", lineCap: "round" }).addTo(group);
    }
    for (const place of content.markers) {
      L.marker([place.lat, place.lon], { icon: markerIcon(place.moving ? movingColor : parkedColor, place.heading), keyboard: false }).addTo(group);
    }
    if (following.current && !sameMarkers(shown.current, content.markers)) centre(m, content.markers);
    shown.current = content.markers;
  }, [content, color, casing, movingColor, parkedColor]);

  if (!loaded) return null;
  if (!hasPlaces && !content.note) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
        Nothing yet. The map appears here when the plugin sends a location.
      </Typography>
    );
  }

  const stopped = saved ? now - Date.parse(saved.updatedAt) > STOPPED_MS : false;
  const warning = content.note || (stopped ? "Not updating. Check the extension in Extensions → Manage extensions." : "");

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", minHeight: 0, isolation: "isolate", overflow: "hidden" }}>
      <Box
        ref={holder}
        sx={{ position: "absolute", inset: 0, ...mapSx(dark) }}
      />
      {wandered ? (
        <Tooltip title="Back to the location">
          <IconButton
            aria-label="Back to the location"
            size="small"
            onClick={() => {
              following.current = true;
              setWandered(false);
              if (map.current) centre(map.current, content.markers);
            }}
            sx={{
              position: "absolute",
              top: 32,
              right: 8,
              zIndex: 1000,
              bgcolor: "background.paper",
              boxShadow: 2,
              "&:hover": { bgcolor: "background.paper" },
            }}
          >
            <MyLocationIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
      {/* One slim line per tracker along the bottom edge, so the map stays in view even on a small panel. */}
      <Stack
        sx={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 1000, pointerEvents: "none" }}
      >
        {content.markers.map((place) => (
          <Box key={place.id} sx={{ px: 1, py: 0.25, bgcolor: (t) => alpha(t.palette.background.paper, 0.85), borderTop: 1, borderColor: "divider" }}>
            <Typography variant="caption" component="div" noWrap title={[place.label, place.detail, place.at ? `Last report ${timeAgo(place.at, now)}` : ""].filter(Boolean).join(" · ")}>
              <Box component="span" sx={{ fontWeight: "fontWeightBold" }}>
                {place.label}
              </Box>
              <Box component="span" sx={{ color: "text.secondary" }}>
                {[place.detail, place.at ? timeAgo(place.at, now) : ""].filter(Boolean).map((part) => ` · ${part}`).join("")}
              </Box>
            </Typography>
          </Box>
        ))}
        {warning ? (
          <Box sx={{ px: 1, py: 0.5, bgcolor: "warning.main", color: "warning.contrastText" }}>
            <Typography variant="caption" component="div">
              {warning}
            </Typography>
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
