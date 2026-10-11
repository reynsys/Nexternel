import type { SvgIconComponent } from "@mui/icons-material";
import BatteryFullIcon from "@mui/icons-material/BatteryFull";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import DevicesOtherIcon from "@mui/icons-material/DevicesOther";
import MemoryIcon from "@mui/icons-material/Memory";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import BoltIcon from "@mui/icons-material/Bolt";
import CloudIcon from "@mui/icons-material/Cloud";
import Co2Icon from "@mui/icons-material/Co2";
import DeviceThermostatIcon from "@mui/icons-material/DeviceThermostat";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import DoorFrontIcon from "@mui/icons-material/DoorFront";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import ElectricMeterIcon from "@mui/icons-material/ElectricMeter";
import GrainIcon from "@mui/icons-material/Grain";
import LightModeIcon from "@mui/icons-material/LightMode";
import LockIcon from "@mui/icons-material/Lock";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotesIcon from "@mui/icons-material/Notes";
import NumbersIcon from "@mui/icons-material/Numbers";
import PaletteIcon from "@mui/icons-material/Palette";
import PlaceIcon from "@mui/icons-material/Place";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import SensorsIcon from "@mui/icons-material/Sensors";
import SpeedIcon from "@mui/icons-material/Speed";
import VideocamIcon from "@mui/icons-material/Videocam";
import WaterDropIcon from "@mui/icons-material/WaterDrop";

/** One icon per capability kind (domain `CAPABILITY_KINDS`). */
const KIND_ICONS: Record<string, SvgIconComponent> = {
  temperature: DeviceThermostatIcon,
  humidity: WaterDropIcon,
  pressure: SpeedIcon,
  battery: BatteryFullIcon,
  voltage: ElectricBoltIcon,
  current: ElectricBoltIcon,
  power: BoltIcon,
  energy: ElectricMeterIcon,
  co2: Co2Icon,
  pm1: GrainIcon,
  pm25: GrainIcon,
  pm10: GrainIcon,
  number: NumbersIcon,
  switch: PowerSettingsNewIcon,
  brightness: LightModeIcon,
  colour: PaletteIcon,
  motion: DirectionsRunIcon,
  door: DoorFrontIcon,
  lock: LockIcon,
  camera: VideocamIcon,
  alarm: NotificationsActiveIcon,
  weather: CloudIcon,
  gps: PlaceIcon,
  binary_sensor: SensorsIcon,
  enum: NotesIcon,
  text: NotesIcon,
  json: NotesIcon,
  // Panels whose title is not one reading: the kind of panel.
  "panel.clock": ScheduleIcon,
  "panel.calendar": CalendarMonthIcon,
  "panel.weather": CloudIcon,
  "panel.system": MemoryIcon,
  "panel.devices": DevicesOtherIcon,
  "panel.status": SensorsIcon,
  "panel.controls": ToggleOnIcon,
  "panel.charts": ShowChartIcon,
  "panel.camera": VideocamIcon,
};

/**
 * The automatic icon for a kind of reading. A reading's own chosen icon (Devices → reading, or a
 * panel's Names & icons) is shown with ItemIcon; this is what "Automatic" means.
 */
export function kindIcon(kind: string | null | undefined): SvgIconComponent {
  return KIND_ICONS[kind ?? ""] ?? SensorsIcon;
}
