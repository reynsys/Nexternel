import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Paper,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useSearchParams } from "react-router-dom";
import type { Theme } from "@mui/material/styles";
import { api } from "../../api";
import { ButtonRow } from "../../components/ButtonRow";
import { hasPermission } from "../../lib/permissions";
import { dayRange, duration, periodRange, toDateInput, type ReportPeriod } from "../../lib/tracking-format";
import type { MapLook } from "../../lib/map-panel-content";
import { contentSurfaceSx } from "../../skins/surfaceStyles";
import { useShellAuth } from "../../skins/useShellAuth";
import { MapPanel } from "../blocks/MapPanel";
import { PluginPageSettings } from "../PluginPageSettings";
import { TrackingMap, type MapCircle, type MapDot } from "./TrackingMap";

type Tracker = { id: number; name: string; status: string };
type Overview = {
  admin: boolean;
  speedUnit: string;
  distanceUnit: string;
  trackers: Tracker[];
  places: { lat: number; lon: number; label: string }[];
  mapLook: MapLook;
};
type Trip = { kind: "trip"; start: string; end: string; minutes: number; distance: number; topSpeed: number; from: string; to: string };
type Stop = { kind: "stop"; start: string; end: string; minutes: number; lat: number; lon: number; place: string };
type Entry = Trip | Stop;
type Point = [number, number, string, number];
type TrackerSummary = { id: number; name: string; journeys: number; distance: number; minutes: number; topSpeed: number };
type Area = MapCircle & { id: string; name: string };
type AlertSettings = { speedLimit: number; quietOn: boolean; quietFrom: string; quietTo: string };

type PageProps = { pluginId: string; pageId: string; title: string; mapPanelId: string | null };
type Call = <T>(action: string, params?: Record<string, unknown>) => Promise<T>;

const clock = (at: string) => new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const REPLAY_STEP_MS = 120;
const SETTINGS_TAB = 4;
const RESTART_CHECKS_MS = [2000, 5000, 9000];

function useMessage() {
  const [message, setMessage] = useState<string | null>(null);
  const guard = useCallback(async <T,>(work: Promise<T>) => {
    try {
      setMessage(null);
      return await work;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That did not work.");
      return null;
    }
  }, []);
  return { message, guard };
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ ...contentSurfaceSx(false), p: 2 }}>
      {children}
    </Paper>
  );
}

function TrackerPicker({ trackers, value, onChange }: { trackers: Tracker[]; value: number; onChange: (id: number) => void }) {
  if (trackers.length < 2) return null;
  return (
    <TextField select size="small" label="Tracker" value={value} onChange={(e) => onChange(Number(e.target.value))} sx={{ minWidth: 180 }}>
      {trackers.map((t) => (
        <MenuItem key={t.id} value={t.id}>
          {t.name}
        </MenuItem>
      ))}
    </TextField>
  );
}

function AddTracker({ call, onAdded }: { call: Call; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [uniqueId, setUniqueId] = useState("");
  const { message, guard } = useMessage();
  return (
    <Section>
      <Stack spacing={1.5} sx={{ maxWidth: 420 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: "fontWeightBold" }}>
          Add your first tracker
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The ID number is printed on the tracker or in its instructions.
        </Typography>
        {message ? <Alert severity="error">{message}</Alert> : null}
        <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField size="small" label="ID number" value={uniqueId} onChange={(e) => setUniqueId(e.target.value)} />
        <Box>
          <Button
            variant="contained"
            onClick={async () => {
              if ((await guard(call("addTracker", { name, uniqueId }))) !== null) onAdded();
            }}
          >
            Add tracker
          </Button>
        </Box>
      </Stack>
    </Section>
  );
}

function Journeys({ call, overview }: { call: Call; overview: Overview }) {
  const [deviceId, setDeviceId] = useState(overview.trackers[0]?.id ?? 0);
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { message, guard } = useMessage();

  useEffect(() => {
    let alive = true;
    setSelected(null);
    setPoints([]);
    setPlaying(false);
    setEntries(null);
    void guard(call<{ trips: Trip[]; stops: Stop[] }>("day", { deviceId, ...dayRange(date) })).then((r) => {
      if (!alive || !r) return;
      setEntries([...r.trips, ...r.stops].sort((a, b) => a.start.localeCompare(b.start)));
    });
    return () => {
      alive = false;
    };
  }, [call, guard, deviceId, date]);

  const open = async (entry: Entry) => {
    setSelected(entry);
    setPlaying(false);
    setPosition(0);
    setPoints([]);
    if (entry.kind === "stop") return;
    const r = await guard(call<{ points: Point[] }>("route", { deviceId, from: entry.start, to: entry.end }));
    if (r) setPoints(r.points);
  };

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setPosition((p) => {
        if (p + 1 >= points.length) {
          setPlaying(false);
          return p;
        }
        return p + 1;
      });
    }, REPLAY_STEP_MS);
    return () => clearInterval(timer);
  }, [playing, points.length]);

  const line = useMemo(() => points.map((p) => [p[0], p[1]] as [number, number]), [points]);
  const dots = useMemo<MapDot[]>(() => {
    if (selected?.kind === "stop") return [{ lat: selected.lat, lon: selected.lon, kind: "now", label: "Stopped here" }];
    if (points.length === 0) return [];
    const first = points[0];
    const last = points[points.length - 1];
    const now = points[Math.min(position, points.length - 1)];
    return [
      { lat: first[0], lon: first[1], kind: "start", label: "Start" },
      { lat: last[0], lon: last[1], kind: "end", label: "End" },
      { lat: now[0], lon: now[1], kind: "now" },
    ];
  }, [points, position, selected]);
  const current = points[Math.min(position, points.length - 1)];

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", rowGap: 1.5 }}>
        <TextField
          type="date"
          size="small"
          label="Day"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TrackerPicker trackers={overview.trackers} value={deviceId} onChange={setDeviceId} />
      </Stack>
      {message ? <Alert severity="error">{message}</Alert> : null}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 1fr) 2fr" } }}>
        <Section>
          {entries === null ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : entries.length === 0 ? (
            <Typography color="text.secondary">Nothing recorded on this day.</Typography>
          ) : (
            <Box sx={{ display: "grid", gap: 1, maxHeight: 480, overflowY: "auto" }}>
              {entries.map((e) => (
                <Button
                  key={`${e.kind}-${e.start}`}
                  variant={selected === e ? "contained" : "outlined"}
                  onClick={() => void open(e)}
                  sx={{ display: "block", textAlign: "left", textTransform: "none" }}
                >
                  <Typography variant="body2" sx={{ fontWeight: "fontWeightBold" }}>
                    {e.kind === "trip" ? `Journey ${clock(e.start)} to ${clock(e.end)}` : `Stopped ${clock(e.start)}`}
                  </Typography>
                  <Typography variant="caption" component="div">
                    {e.kind === "trip"
                      ? [
                          `${e.distance} ${overview.distanceUnit}`,
                          duration(e.minutes),
                          `top ${e.topSpeed} ${overview.speedUnit}`,
                          e.from || e.to ? `${e.from || "?"} to ${e.to || "?"}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : [duration(e.minutes), e.place].filter(Boolean).join(" · ")}
                  </Typography>
                </Button>
              ))}
            </Box>
          )}
        </Section>
        <Section>
          <Stack spacing={1}>
            <TrackingMap
              line={line}
              dots={dots}
              fitKey={selected ? `${selected.start}-${points.length}` : ""}
              look={overview.mapLook}
            />
            {selected?.kind === "trip" && points.length > 1 ? (
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Button
                  variant="outlined"
                  startIcon={playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
                  onClick={() => {
                    if (position + 1 >= points.length) setPosition(0);
                    setPlaying(!playing);
                  }}
                >
                  {playing ? "Pause" : "Replay"}
                </Button>
                <Slider
                  aria-label="Replay position"
                  min={0}
                  max={points.length - 1}
                  value={position}
                  onChange={(_, v) => {
                    setPlaying(false);
                    setPosition(v as number);
                  }}
                />
                <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                  {current ? `${clock(current[2])}, ${current[3]} ${overview.speedUnit}` : ""}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {selected ? "" : "Choose a journey to see its route and replay it."}
              </Typography>
            )}
          </Stack>
        </Section>
      </Box>
    </Stack>
  );
}

function Reports({ call, overview }: { call: Call; overview: Overview }) {
  const [period, setPeriod] = useState<ReportPeriod>("week");
  const [rows, setRows] = useState<TrackerSummary[] | null>(null);
  const { message, guard } = useMessage();

  useEffect(() => {
    let alive = true;
    setRows(null);
    void guard(call<{ trackers: TrackerSummary[] }>("summary", periodRange(period, new Date()))).then((r) => {
      if (alive && r) setRows(r.trackers);
    });
    return () => {
      alive = false;
    };
  }, [call, guard, period]);

  return (
    <Stack spacing={2}>
      <TextField
        select
        size="small"
        label="Period"
        value={period}
        onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
        sx={{ maxWidth: 220 }}
      >
        <MenuItem value="week">This week</MenuItem>
        <MenuItem value="lastWeek">Last week</MenuItem>
        <MenuItem value="month">This month</MenuItem>
        <MenuItem value="days30">Last 30 days</MenuItem>
      </TextField>
      {message ? <Alert severity="error">{message}</Alert> : null}
      {rows === null ? <Typography color="text.secondary">Working it out…</Typography> : null}
      {(rows ?? []).map((r) => (
        <Section key={r.id}>
          <Typography variant="subtitle2" sx={{ fontWeight: "fontWeightBold", mb: 1.5 }}>
            {r.name}
          </Typography>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
            {[
              ["Distance", `${r.distance} ${overview.distanceUnit}`],
              ["Driving time", duration(r.minutes)],
              ["Journeys", String(r.journeys)],
              ["Top speed", `${r.topSpeed} ${overview.speedUnit}`],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary" component="div">
                  {label}
                </Typography>
                <Typography variant="h6">{value}</Typography>
              </Box>
            ))}
          </Box>
        </Section>
      ))}
      <Typography variant="caption" color="text.secondary">
        GPS history is kept for one month.
      </Typography>
    </Stack>
  );
}

function AlertsBlocked() {
  return (
    <Alert severity="warning">
      GPS Tracker is not allowed to send alerts. Allow it under Extensions → Manage extensions → GPS Tracker → Permissions.
    </Alert>
  );
}

function Areas({ call, overview }: { call: Call; overview: Overview }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [canNotify, setCanNotify] = useState(true);
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);
  const [name, setName] = useState("");
  const [radius, setRadius] = useState(200);
  const { message, guard } = useMessage();
  const admin = overview.admin;

  const load = useCallback(async () => {
    const r = await guard(call<{ areas: (Area & { name: string })[]; canNotify: boolean }>("alerts"));
    if (!r) return;
    setAreas(r.areas.map((a) => ({ ...a, label: a.name })));
    setCanNotify(r.canNotify);
  }, [call, guard]);
  useEffect(() => void load(), [load]);

  const circles = useMemo<MapCircle[]>(
    () => [...areas, ...(picked ? [{ ...picked, radius, label: name || "New area" }] : [])],
    [areas, picked, radius, name]
  );

  return (
    <Stack spacing={2}>
      {message ? <Alert severity="error">{message}</Alert> : null}
      {!canNotify ? <AlertsBlocked /> : null}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 1fr) 2fr" } }}>
        <Section>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: "fontWeightBold" }}>
              Areas
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You get an alert when a tracker arrives at or leaves an area.
            </Typography>
            {areas.map((a) => (
              <Stack key={a.id} direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="body2">
                  {a.name} ({a.radius} m)
                </Typography>
                {admin ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={async () => {
                      if ((await guard(call("removeArea", { id: a.id }))) !== null) void load();
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </Stack>
            ))}
            {admin ? (
              <>
                <Typography variant="body2">
                  {picked ? "Now name it:" : "To add one, click the place on the map."}
                </Typography>
                {picked ? (
                  <>
                    <TextField size="small" label="Area name" value={name} onChange={(e) => setName(e.target.value)} />
                    <Typography variant="caption" color="text.secondary">
                      Size: {radius} m around the point
                    </Typography>
                    <Slider aria-label="Area size" min={50} max={2000} step={50} value={radius} onChange={(_, v) => setRadius(v as number)} />
                    <ButtonRow>
                      <Button
                        variant="contained"
                        onClick={async () => {
                          if ((await guard(call("addArea", { ...picked, name, radius }))) === null) return;
                          setPicked(null);
                          setName("");
                          void load();
                        }}
                      >
                        Save area
                      </Button>
                      <Button variant="outlined" onClick={() => setPicked(null)}>
                        Cancel
                      </Button>
                    </ButtonRow>
                  </>
                ) : null}
              </>
            ) : null}
          </Stack>
        </Section>
        <Section>
          <TrackingMap
            circles={circles}
            dots={picked ? [{ ...picked, kind: "now" }] : overview.places.map((p) => ({ ...p, kind: "now" as const }))}
            fitKey={String(areas.length)}
            onPick={admin ? (lat, lon) => setPicked({ lat, lon }) : undefined}
            height={360}
            look={overview.mapLook}
          />
        </Section>
      </Box>
    </Stack>
  );
}

function SettingsTab({
  call,
  overview,
  pluginId,
  canChangeSettings,
  onSaved,
}: {
  call: Call;
  overview: Overview;
  pluginId: string;
  canChangeSettings: boolean;
  onSaved: () => void;
}) {
  const [alerts, setAlerts] = useState<AlertSettings | null>(null);
  const [canNotify, setCanNotify] = useState(true);
  const [saved, setSaved] = useState(false);
  const { message, guard } = useMessage();

  useEffect(() => {
    void guard(call<{ alerts: AlertSettings; canNotify: boolean }>("alerts")).then((r) => {
      if (!r) return;
      setAlerts(r.alerts);
      setCanNotify(r.canNotify);
    });
  }, [call, guard]);

  const change = (next: Partial<AlertSettings>) => {
    setSaved(false);
    setAlerts((a) => (a ? { ...a, ...next } : a));
  };

  return (
    <Stack spacing={2}>
      {message ? <Alert severity="error">{message}</Alert> : null}
      {canChangeSettings ? (
        <Section>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: "fontWeightBold" }}>
              Map and units
            </Typography>
            <PluginPageSettings pluginId={pluginId} onSaved={onSaved} />
          </Stack>
        </Section>
      ) : null}
      {alerts && overview.admin ? (
        <Section>
          <Stack spacing={1.5} sx={{ maxWidth: 420 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: "fontWeightBold" }}>
              Alerts
            </Typography>
            {!canNotify ? <AlertsBlocked /> : null}
            <TextField
              size="small"
              type="number"
              label={`Speed limit (${overview.speedUnit}), 0 for none`}
              value={alerts.speedLimit}
              onChange={(e) => change({ speedLimit: Number(e.target.value) })}
            />
            <FormControlLabel
              control={<Switch checked={alerts.quietOn} onChange={(e) => change({ quietOn: e.target.checked })} />}
              label="Alert me if a tracker moves during quiet hours"
            />
            {alerts.quietOn ? (
              <Stack direction="row" spacing={1.5}>
                <TextField
                  size="small"
                  type="time"
                  label="From"
                  value={alerts.quietFrom}
                  onChange={(e) => change({ quietFrom: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  size="small"
                  type="time"
                  label="To"
                  value={alerts.quietTo}
                  onChange={(e) => change({ quietTo: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
            ) : null}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Button
                variant="contained"
                onClick={async () => {
                  setSaved((await guard(call("saveAlerts", alerts))) !== null);
                }}
              >
                Save alerts
              </Button>
              {saved ? (
                <Typography variant="body2" color="text.secondary">
                  Saved
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        </Section>
      ) : null}
    </Stack>
  );
}

/** The GPS Tracker page: live map, journeys, reports, areas and settings. Everything comes from the plugin. */
export function TrackingPage({ pluginId, pageId, title, mapPanelId }: PageProps) {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => (searchParams.get("tab") === "settings" ? SETTINGS_TAB : 0));
  const [overview, setOverview] = useState<Overview | null>(null);
  const { isAdmin, permissions } = useShellAuth();
  const canChangeSettings = hasPermission(permissions, "manageUsers", Boolean(isAdmin));
  const { message, guard } = useMessage();
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const call = useCallback<Call>(
    <T,>(action: string, params: Record<string, unknown> = {}) => api.pluginPageCall<T>(pluginId, pageId, action, params),
    [pluginId, pageId]
  );
  const load = useCallback(() => {
    void guard(call<Overview>("overview")).then((r) => r && setOverview(r));
  }, [call, guard]);
  useEffect(load, [load]);

  // Who cannot change anything has no Settings tab. Until the page knows, it keeps the tab it was opened on.
  const showSettings = !overview || overview.admin || canChangeSettings;
  const shownTab = tab === SETTINGS_TAB && !showSettings ? 0 : tab;
  const reloadAfterSave = useCallback(() => {
    // Saving restarts the extension for a few seconds; pick up the new units and map colours when it is back.
    for (const wait of RESTART_CHECKS_MS) {
      window.setTimeout(() => void call<Overview>("overview").then(setOverview).catch(() => {}), wait);
    }
  }, [call]);

  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Typography variant="h5" component="h1">
        {title}
      </Typography>
      {message ? <Alert severity="error">{message}</Alert> : null}
      {overview && overview.trackers.length === 0 && overview.admin ? <AddTracker call={call} onAdded={load} /> : null}
      <Tabs value={shownTab} onChange={(_, v) => setTab(v as number)} variant="scrollable" allowScrollButtonsMobile>
        <Tab label="Live" />
        <Tab label="Journeys" />
        <Tab label="Reports" />
        <Tab label="Areas" />
        {showSettings ? <Tab label="Settings" /> : null}
      </Tabs>
      {shownTab === 0 && mapPanelId ? (
        <Section>
          <FillingMapBox>
            <MapPanel pluginId={pluginId} panelId={mapPanelId} />
          </FillingMapBox>
        </Section>
      ) : null}
      {shownTab === 1 && overview ? <Journeys call={call} overview={overview} /> : null}
      {shownTab === 2 && overview ? <Reports call={call} overview={overview} /> : null}
      {shownTab === 3 && overview ? <Areas call={call} overview={overview} /> : null}
      {shownTab === SETTINGS_TAB && overview ? (
        <SettingsTab
          call={call}
          overview={overview}
          pluginId={pluginId}
          canChangeSettings={canChangeSettings}
          onSaved={reloadAfterSave}
        />
      ) : null}
    </Stack>
  );
}


/**
 * The Live map: on phones and tablets it reaches down to the bottom of the screen (less the page's own
 * padding), so there is no empty space under it; on wide screens it keeps its fixed height.
 */
function FillingMapBox({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery((t: Theme) => t.breakpoints.up("md"));
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (wide) return;
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      // Room for the section's padding and border under the map.
      setHeight(Math.max(320, Math.round(window.innerHeight - top - 40)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [wide]);
  return (
    <Box ref={ref} sx={{ height: wide ? 560 : height ?? 420 }}>
      {children}
    </Box>
  );
}
