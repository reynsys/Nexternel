import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../../api";
import { ButtonRow } from "../../components/ButtonRow";
import { dayRange, duration, periodRange, toDateInput, type ReportPeriod } from "../../lib/tracking-format";
import type { MapLook } from "../../lib/map-panel-content";
import { contentSurfaceSx } from "../../skins/surfaceStyles";
import { MapPanel } from "../blocks/MapPanel";
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

function AreasAlerts({ call, overview }: { call: Call; overview: Overview }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [canNotify, setCanNotify] = useState(true);
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);
  const [name, setName] = useState("");
  const [radius, setRadius] = useState(200);
  const [saved, setSaved] = useState(false);
  const { message, guard } = useMessage();
  const admin = overview.admin;

  const load = useCallback(async () => {
    const r = await guard(
      call<{ areas: (Area & { name: string })[]; alerts: AlertSettings; canNotify: boolean }>("alerts")
    );
    if (!r) return;
    setAreas(r.areas.map((a) => ({ ...a, label: a.name })));
    setSettings(r.alerts);
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
      {!canNotify ? (
        <Alert severity="warning">
          This plugin is not allowed to send alerts. Allow it under Settings → Extensions → GPS tracking.
        </Alert>
      ) : null}
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
      {settings ? (
        <Section>
          <Stack spacing={1.5} sx={{ maxWidth: 420 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: "fontWeightBold" }}>
              Alerts
            </Typography>
            <TextField
              size="small"
              type="number"
              disabled={!admin}
              label={`Speed limit (${overview.speedUnit}), 0 for none`}
              value={settings.speedLimit}
              onChange={(e) => setSettings({ ...settings, speedLimit: Number(e.target.value) })}
            />
            <FormControlLabel
              control={
                <Switch
                  disabled={!admin}
                  checked={settings.quietOn}
                  onChange={(e) => setSettings({ ...settings, quietOn: e.target.checked })}
                />
              }
              label="Alert me if a tracker moves during quiet hours"
            />
            {settings.quietOn ? (
              <Stack direction="row" spacing={1.5}>
                <TextField
                  size="small"
                  type="time"
                  disabled={!admin}
                  label="From"
                  value={settings.quietFrom}
                  onChange={(e) => setSettings({ ...settings, quietFrom: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  size="small"
                  type="time"
                  disabled={!admin}
                  label="To"
                  value={settings.quietTo}
                  onChange={(e) => setSettings({ ...settings, quietTo: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
            ) : null}
            {admin ? (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Button
                  variant="contained"
                  onClick={async () => {
                    setSaved((await guard(call("saveAlerts", settings))) !== null);
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
            ) : null}
          </Stack>
        </Section>
      ) : null}
    </Stack>
  );
}

/** The GPS page: live map, journeys, reports, areas and alerts. Everything comes from the plugin. */
export function TrackingPage({ pluginId, pageId, title, mapPanelId }: PageProps) {
  const [tab, setTab] = useState(0);
  const [overview, setOverview] = useState<Overview | null>(null);
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

  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Typography variant="h5" component="h1">
        {title}
      </Typography>
      {message ? <Alert severity="error">{message}</Alert> : null}
      {overview && overview.trackers.length === 0 && overview.admin ? <AddTracker call={call} onAdded={load} /> : null}
      <Tabs value={tab} onChange={(_, v) => setTab(v as number)} variant="scrollable" allowScrollButtonsMobile>
        <Tab label="Live" />
        <Tab label="Journeys" />
        <Tab label="Reports" />
        <Tab label="Areas and alerts" />
      </Tabs>
      {tab === 0 && mapPanelId ? (
        <Section>
          <Box sx={{ height: { xs: 420, md: 560 } }}>
            <MapPanel pluginId={pluginId} panelId={mapPanelId} />
          </Box>
        </Section>
      ) : null}
      {tab === 1 && overview ? <Journeys call={call} overview={overview} /> : null}
      {tab === 2 && overview ? <Reports call={call} overview={overview} /> : null}
      {tab === 3 && overview ? <AreasAlerts call={call} overview={overview} /> : null}
    </Stack>
  );
}
