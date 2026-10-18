import { useEffect, useState, type ReactNode } from "react";
import { PanelEditorShell } from "../components/panel-editor/PanelEditorShell";
import {
  Alert,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
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
import { PanelMotionField } from "../components/PanelMotionField";
import { readPanelMotion, writePanelMotion, type PanelMotion } from "../lib/motion";

type Props = {
  open: boolean;
  widget: WidgetInstance | null;
  onClose: () => void;
  onSave: (patch: Partial<WidgetInstance>) => void;
  /** The title and icon the panel shows when none are set. */
  automatic?: AutomaticTitle;
  /** Draws the panel as it would look with these unsaved changes (the Edit menu's preview). */
  renderPreview?: (patch: Partial<WidgetInstance>) => ReactNode;
};

const TYPE_LABELS: Record<GeneralWidgetType, string> = {
  calendar: "Calendar",
  clock: "Clock",
  weather: "Weather",
  system_info: "System",
  device_status: "Devices",
  camera: "Camera",
};

export function GeneralWidgetEditor({ open, widget, onClose, onSave, automatic, renderPreview }: Props) {
  const [title, setTitle] = useState("");
  const [titleIcon, setTitleIcon] = useState("auto");
  const [motion, setMotion] = useState<PanelMotion>(readPanelMotion(widget?.config));
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
    setMotion(readPanelMotion(widget.config));
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

  function buildPatch(): Partial<WidgetInstance> {
    if (!widget) return {};
    const config: Record<string, unknown> = writePanelMotion(writeTitleIcon({ ...(widget.config ?? {}) }, titleIcon), motion);
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
    return {
      title: trimmed || undefined,
      config,
    };
  }

  function handleApply() {
    if (!widget) return;
    onSave(buildPatch());
    onClose();
  }

  if (!widget) return null;
  return (
    <PanelEditorShell
      open={open}
      title={`Edit ${title.trim() || label}`}
      kindLabel={label}
      preview={open && renderPreview ? renderPreview(buildPatch()) : null}
      onCancel={onClose}
      onApply={handleApply}
      tabs={[
        {
          id: "content",
          label: "Content",
          content:
            type === "weather" || type === "device_status" || type === "camera" ? (
              <>
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
              helperText="The name shown on the panel. Look up fills in the position below."
            />
            <Button
              variant="outlined"
              disabled={geocodeBusy}
              onClick={() => void lookupPlace()}
            >
              {geocodeBusy ? "Looking up…" : "Look up this place"}
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
            />
            <TextField
              label="Longitude"
              size="small"
              fullWidth
              value={weatherLon}
              onChange={(e) => setWeatherLon(e.target.value)}
              inputProps={{ inputMode: "decimal" }}
            />
            <Typography variant="caption" color="text.secondary">
              Forecasts come from Open-Meteo (UK Met Office model).
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

              </>
            ) : null,
        },
        {
          id: "look",
          label: "Look",
          content: (
            <>
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
        <PanelMotionField value={motion} onChange={setMotion} />

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
                <MenuItem value="theme">Same as the dashboard (Appearance → Font)</MenuItem>
                <MenuItem value="sans">Plain (Arial)</MenuItem>
                <MenuItem value="serif">Classic (Georgia)</MenuItem>
                <MenuItem value="mono">Typewriter</MenuItem>
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

            </>
          ),
        },
      ]}
    />
  );
}
