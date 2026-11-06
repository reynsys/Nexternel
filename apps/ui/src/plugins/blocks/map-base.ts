import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** A map with Nexternel's map pictures and their credit, zoomed with the buttons so the page still scrolls. */
export function createMap(element: HTMLElement): L.Map {
  const map = L.map(element, { scrollWheelZoom: false, attributionControl: false });
  L.control.attribution({ prefix: false, position: "topright" }).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
  }).addTo(map);
  return map;
}

/** Dark screens get a dark map (the same map with its colours turned over); zoom buttons and credit follow the Look. */
export function mapSx(dark: boolean) {
  return {
    bgcolor: "action.hover",
    ...(dark ? { "& .leaflet-tile-pane": { filter: "invert(1) hue-rotate(180deg) brightness(.95) contrast(.9)" } } : {}),
    "& .leaflet-bar a, & .leaflet-bar a:hover": {
      bgcolor: "background.paper",
      color: "text.primary",
      borderColor: "divider",
    },
    "&.leaflet-container .leaflet-control-attribution": { bgcolor: "background.paper", color: "text.secondary" },
  };
}
