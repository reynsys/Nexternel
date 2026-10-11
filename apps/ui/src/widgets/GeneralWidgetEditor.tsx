import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Drawer,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { api, type CameraRecord, type WidgetInstance } from "../api";
import {
  generalWidgetHeading,
  isGeneralWidgetType,
  parseCameraConfig,
  parseDeviceStatusConfig,
  parseWeatherConfig,
  type GeneralWidgetType,
} from "./general/config";
import {
  parseClockConfig,
  type ClockColor,
  type ClockDial,
  type ClockFace,
  type ClockFont,
} from "./general/clock-config";
import { PanelTitleFields, type AutomaticTitle } from "../components/PanelTitleFields";
import { readTitleIcon, writeTitleIcon } from "../lib/panel-title-icon";

type Props = {
  open: boolean;
  widget: WidgetInstance | null;
  onClose: () => void;
  onSave: (patch: Partial<WidgetInstance>) => void;
  /** The title and icon the panel shows when none are set. */
  automatic?: AutomaticTitle;
};

const TYPE_LABELS: Record<GeneralWidgetType, string> = {
  calendar: "Calendar",
  clock: "Clock",
  weather: "Weather",
  system_info: "System",
  device_status: "Devices",
  camera: "Camera",
};

export function GeneralWidgetEditor({ open, widget, onClose, onSave, automatic }: Props) {
  const [title, setTitle] = useState("");
  const [titleIcon, setTitleIcon] = useState("auto");
  const [weatherLocation, setWeatherLocation] = useState("London");
  const [weatherLat, setWeatherLat] = useState("51.5074");
  const [weatherLon, setWeatherLon] = useState("-0.1278");
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocodeHint, setGeocodeHint] = useState<string | null>(null);
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [cameraId, setCameraId] = useState("");
  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [clockFace, setClockFace] = useState<ClockFace>("digital");
  const [clockDial, setClockDial] = useState<ClockDial>("classic");
  const [clockFont, setClockFont] = useState<ClockFont>("theme");
  const [clockColor, setClockColor] = useState<ClockColor>("text");
  const [clockBold, setClockBold] = useState(true);
  const [clockItalic, setClockItalic] = useState(false);

  useEffect(() => {
    if (!open || !widget || !isGeneralWidgetType(widget.type)) return;
    const type = widget.type as GeneralWidgetType;
    setGeocodeError(null);
    setGeocodeHint(null);
    if (type === "weather") {
      const w = parseWeatherConfig(widget.config);
      const loc = w.weatherLocation === "Weather" ? "London" : w.weatherLocation;
      setWeatherLocation(loc);
      setWeatherLat(String(w.weatherLat));
      setWeatherLon(String(w.weatherLon));
      setTitle(widget.title ?? "");
    } else {
      setTitle(widget.title ?? "");
    }
    setOfflineOnly(parseDeviceStatusConfig(widget.config).offlineOnly);
    setTitleIcon(readTitleIcon(widget.config));
    setCameraId(parseCameraConfig(widget.config).cameraId);
    if (type === "clock") {
      const clock = parseClockConfig(widget.config);
      setClockFace(clock.face);
      setClockDial(clock.dial);
      setClockFont(clock.font);
      setClockColor(clock.color);
      setClockBold(clock.bold);
      setClockItalic(clock.italic);
    }
  }, [open, widget?.id]);

  useEffect(() => {
    if (!open || widget?.type !== "camera") return;
    void api
      .cameras()
      .then((r) => setCameras(r.cameras.filter((c) => c.enabled)))
      .catch(() => setCameras([]));
  }, [open, widget?.type]);

  if (!widget || !isGeneralWidgetType(widget.type)) return null;

  const type = widget.type;
  const label = TYPE_LABELS[type];

  async function lookupPlace() {
    const q = weatherLocation.trim();
    if (q.length < 2) {
      setGeocodeError("Enter a place name first (e.g. town or postcode area)");
      return;
    }
    setGeocodeBusy(true);
    setGeocodeError(null);
    setGeocodeHint(null);
    try {
      const { results } = await api.weatherGeocode(q);
      const best = results[0];
      if (!best) {
        setGeocodeError(
          "No matches — try a clearer place name or enter lat/lon manually"
        );
        return;
      }
      setWeatherLat(String(best.latitude));
      setWeatherLon(String(best.longitude));
      setWeatherLocation(best.name);
      setGeocodeHint(
        `Using ${best.label} → ${best.latitude.toFixed(4)}, ${best.longitude.toFixed(4)}`
      );
    } catch (err) {
      setGeocodeError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setGeocodeBusy(false);
    }
  }

  function handleApply() {
    if (!widget) return;
    const config: Record<string, unknown> = writeTitleIcon({ ...(widget.config ?? {}) }, titleIcon);
    if (type === "weather") {
      const lat = Number(weatherLat);
      const lon = Number(weatherLon);
      config.weatherLocation = weatherLocation.trim() || "London";
      config.weatherLat = Number.isFinite(lat) ? lat : 51.5074;
      config.weatherLon = Number.isFinite(lon) ? lon : -0.1278;
    }
    if (type === "device_status") {
      config.offlineOnly = offlineOnly;
    }
    if (type === "camera") {
      config.cameraId = cameraId;
    }
    if (type === "clock") {
      config.clockFace = clockFace;
      config.clockDial = clockDial;
      config.clockFont = clockFont;
      config.clockColor = clockColor;
      config.clockBold = clockBold;
      config.clockItalic = clockItalic;
    }
    const trimmed = title.trim();
    onSave({
      title: trimmed || undefined,
      config,
    });
    onClose();
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 400 }, p: 2 } }}
    >
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Typography variant="h6">Edit {label.toLowerCase()}</Typography>
        <Typography variant="caption" color="text.secondary">
          {type === "weather"
            ? "Forecast uses Latitude / Longitude (Open-Meteo). The location label is only the heading — use Look up to fill coordinates from a place name."
            : type === "device_status"
              ? "Optional title (default: Devices) and offline-only list."
              : type === "camera"
                ? "Choose a camera registered under Cameras. Stream plays via go2rtc."
                : type === "clock"
                  ? "The time grows and shrinks with the panel. Colour and the Theme font follow the dashboard."
                  : `Optional title (default: ${label}). Data refreshes automatically.`}
        </Typography>

        <PanelTitleFields
          title={title}
          onTitleChange={setTitle}
          icon={titleIcon}
          onIconChange={setTitleIcon}
          automatic={
            automatic ?? {
              title: type === "weather" ? weatherLocation || "Weather" : generalWidgetHeading(widget, label),
              icon: { iconId: "auto", kind: null },
            }
          }
        />

        {type === "weather" && (
          <>
            <TextField
              label="Location / place name"
              size="small"
              fullWidth
              value={weatherLocation}
              onChange={(e) => {
                setWeatherLocation(e.target.value);
                setGeocodeHint(null);
              }}
              helperText="Heading text — does not change weather until you Look up or set lat/lon"
            />
            <Button
              variant="outlined"
              disabled={geocodeBusy}
              onClick={() => void lookupPlace()}
            >
              {geocodeBusy ? "Looking up…" : "Look up place → fill lat/lon"}
            </Button>
            {geocodeError && <Alert severity="error">{geocodeError}</Alert>}
            {geocodeHint && <Alert severity="success">{geocodeHint}</Alert>}
            <TextField
              label="Latitude"
              size="small"
              fullWidth
              value={weatherLat}
              onChange={(e) => setWeatherLat(e.target.value)}
              inputProps={{ inputMode: "decimal" }}
              helperText="North/south (−90 to 90). Your exact coords are sent; the forecast model picks the nearest grid cell."
            />
            <TextField
              label="Longitude"
              size="small"
              fullWidth
              value={weatherLon}
              onChange={(e) => setWeatherLon(e.target.value)}
              inputProps={{ inputMode: "decimal" }}
              helperText="East/west (−180 to 180). UK values are typically negative (e.g. −0.85)."
            />
            <Typography variant="caption" color="text.secondary">
              After Apply, save the dashboard. Data is Open-Meteo using UK Met Office model
              fields — not a live copy of the Met Office website (their icons/wording differ).
            </Typography>
          </>
        )}

        {type === "device_status" && (
          <FormControlLabel
            control={
              <Switch
                checked={offlineOnly}
                onChange={(e) => setOfflineOnly(e.target.checked)}
              />
            }
            label="Show offline devices only"
          />
        )}

        {type === "clock" && (
          <>
            <FormControl fullWidth size="small">
              <InputLabel id="clock-face">Display</InputLabel>
              <Select
                labelId="clock-face"
                label="Display"
                value={clockFace}
                onChange={(e) => setClockFace(e.target.value as ClockFace)}
              >
                <MenuItem value="digital">Digital</MenuItem>
                <MenuItem value="analog">Analog</MenuItem>
              </Select>
            </FormControl>
            {clockFace === "analog" && (
              <FormControl fullWidth size="small">
                <InputLabel id="clock-dial">Dial</InputLabel>
                <Select
                  labelId="clock-dial"
                  label="Dial"
                  value={clockDial}
                  onChange={(e) => setClockDial(e.target.value as ClockDial)}
                >
                  <MenuItem value="classic">Classic</MenuItem>
                  <MenuItem value="minimal">Minimal</MenuItem>
                  <MenuItem value="roman">Roman numerals</MenuItem>
                </Select>
              </FormControl>
            )}
            <FormControl fullWidth size="small">
              <InputLabel id="clock-color">Colour</InputLabel>
              <Select
                labelId="clock-color"
                label="Colour"
                value={clockColor}
                onChange={(e) => setClockColor(e.target.value as ClockColor)}
              >
                <MenuItem value="text">Theme text</MenuItem>
                <MenuItem value="accent">Theme accent</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="clock-font">Font</InputLabel>
              <Select
                labelId="clock-font"
                label="Font"
                value={clockFont}
                onChange={(e) => setClockFont(e.target.value as ClockFont)}
              >
                <MenuItem value="theme">Theme</MenuItem>
                <MenuItem value="sans">Sans</MenuItem>
                <MenuItem value="serif">Serif</MenuItem>
                <MenuItem value="mono">Mono</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Switch checked={clockBold} onChange={(e) => setClockBold(e.target.checked)} />}
              label="Bold"
            />
            <FormControlLabel
              control={<Switch checked={clockItalic} onChange={(e) => setClockItalic(e.target.checked)} />}
              label="Italic"
            />
          </>
        )}

        {type === "camera" && (
          <FormControl fullWidth size="small">
            <InputLabel id="camera-pick">Camera</InputLabel>
            <Select
              labelId="camera-pick"
              label="Camera"
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
            >
              <MenuItem value="">
                <em>Select…</em>
              </MenuItem>
              {cameras.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                  {c.areaName ? ` · ${c.areaName}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: "auto", pt: 2 }}>
          <Button variant="outlined" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleApply} fullWidth>
            Apply
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
