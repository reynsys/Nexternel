/** What a plugin's map panel shows. Plugins send it as JSON, so nothing here is trusted. */
export type MapMarker = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  /** When this position was reported (ISO time), if known. */
  at: string | null;
  /** A short line under the name, such as "Parked". */
  detail: string;
  /** Direction of travel in degrees, if known. */
  heading: number | null;
  /** Moving now: the dot is green while moving and red while parked. */
  moving: boolean;
};

/** Map colours: follow Nexternel's look, or always dark or light. */
export type MapLook = "auto" | "dark" | "light";

export type MapContent = {
  markers: MapMarker[];
  trail: [number, number][];
  /** A problem to show on the map, such as "Cannot reach the GPS server". */
  note: string;
  look: MapLook;
};

const EMPTY: MapContent = { markers: [], trail: [], note: "", look: "auto" };

export function parseMapLook(value: unknown): MapLook {
  return value === "dark" || value === "light" ? value : "auto";
}

/** Whether the map is drawn dark, given its setting and whether Nexternel's look is dark. */
export function mapIsDark(look: MapLook, lookIsDark: boolean): boolean {
  return look === "auto" ? lookIsDark : look === "dark";
}

function isPlace(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

function shortText(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export function parseMapContent(body: string): MapContent {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return EMPTY;
  }
  if (typeof raw !== "object" || raw === null) return EMPTY;
  const { markers, trail, note, look } = raw as { markers?: unknown; trail?: unknown; note?: unknown; look?: unknown };
  const parsed: MapMarker[] = [];
  for (const m of Array.isArray(markers) ? markers : []) {
    if (typeof m !== "object" || m === null) continue;
    const { id, label, lat, lon, at, detail, heading, moving } = m as Record<string, unknown>;
    if (!isPlace(lat, lon)) continue;
    const time = typeof at === "string" && Number.isFinite(Date.parse(at)) ? at : null;
    parsed.push({
      id: shortText(id, 100) || String(parsed.length),
      label: shortText(label, 80),
      lat: lat as number,
      lon: lon as number,
      at: time,
      detail: shortText(detail, 120),
      heading: typeof heading === "number" && Number.isFinite(heading) ? heading : null,
      moving: moving === true,
    });
  }
  const line = (Array.isArray(trail) ? trail : []).filter(
    (p): p is [number, number] => Array.isArray(p) && isPlace(p[0], p[1])
  );
  return { markers: parsed, trail: line, note: shortText(note, 200), look: parseMapLook(look) };
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function timeAgo(at: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(at)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}
