import { useEffect, useRef } from "react";
import { Box, useTheme } from "@mui/material";
import L from "leaflet";
import { mapIsDark, type MapLook } from "../../lib/map-panel-content";
import { createMap, mapSx } from "../blocks/map-base";

export type MapDot = { lat: number; lon: number; label?: string; kind?: "start" | "end" | "now" };
export type MapCircle = { lat: number; lon: number; radius: number; label: string };

type Props = {
  line?: [number, number][];
  dots?: MapDot[];
  circles?: MapCircle[];
  /** Changing this moves the map to fit what it shows. */
  fitKey?: string;
  onPick?: (lat: number, lon: number) => void;
  height?: number | string;
  look?: MapLook;
};

const UK_CENTRE: [number, number] = [54, -2];

function dotIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5);box-sizing:border-box"></div>`,
  });
}

/** The map on the GPS page: a route, dots and areas. */
export function TrackingMap({ line = [], dots = [], circles = [], fitKey = "", onPick, height = 420, look = "auto" }: Props) {
  const theme = useTheme();
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const { primary, success, error } = theme.palette;

  useEffect(() => {
    if (!holder.current) return;
    const m = createMap(holder.current);
    m.setView(UK_CENTRE, 6);
    layers.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => pick.current?.(e.latlng.lat, e.latlng.lng));
    map.current = m;
    const sizeWatch = new ResizeObserver(() => m.invalidateSize());
    sizeWatch.observe(holder.current);
    return () => {
      sizeWatch.disconnect();
      m.remove();
      map.current = null;
      layers.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layers.current;
    if (!group) return;
    group.clearLayers();
    if (line.length > 1) L.polyline(line, { color: primary.main, weight: 4, opacity: 0.8 }).addTo(group);
    for (const c of circles) {
      L.circle([c.lat, c.lon], { radius: c.radius, color: primary.main, weight: 2, fillOpacity: 0.12 })
        .bindTooltip(c.label)
        .addTo(group);
    }
    for (const d of dots) {
      const color = d.kind === "start" ? success.main : d.kind === "end" ? error.main : primary.main;
      const marker = L.marker([d.lat, d.lon], { icon: dotIcon(color), keyboard: false, zIndexOffset: d.kind === "now" ? 500 : 0 });
      if (d.label) marker.bindTooltip(d.label);
      marker.addTo(group);
    }
  }, [line, dots, circles, primary.main, success.main, error.main]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const points: [number, number][] = [
      ...line,
      ...dots.map((d) => [d.lat, d.lon] as [number, number]),
      ...circles.map((c) => [c.lat, c.lon] as [number, number]),
    ];
    if (points.length === 1) m.setView(points[0], 15);
    else if (points.length > 1) m.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 16 });
    // Only when asked: the moving replay dot must not keep shifting the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <Box
      ref={holder}
      sx={{
        width: "100%",
        height,
        minHeight: 240,
        isolation: "isolate",
        overflow: "hidden",
        borderRadius: 1,
        ...(onPick ? { cursor: "crosshair" } : {}),
        ...mapSx(mapIsDark(look, theme.palette.mode === "dark")),
      }}
    />
  );
}
