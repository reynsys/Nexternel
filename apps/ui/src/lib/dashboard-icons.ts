import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import DashboardIcon from "@mui/icons-material/Dashboard";
import HomeIcon from "@mui/icons-material/Home";
import WeekendIcon from "@mui/icons-material/Weekend";
import HotelIcon from "@mui/icons-material/Hotel";
import KitchenIcon from "@mui/icons-material/Kitchen";
import BathtubIcon from "@mui/icons-material/Bathtub";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import ParkIcon from "@mui/icons-material/Park";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import SpeedIcon from "@mui/icons-material/Speed";
import BoltIcon from "@mui/icons-material/Bolt";
import WifiIcon from "@mui/icons-material/Wifi";
import MemoryIcon from "@mui/icons-material/Memory";
import ComputerIcon from "@mui/icons-material/Computer";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import StarIcon from "@mui/icons-material/Star";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import SensorsIcon from "@mui/icons-material/Sensors";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import GrassIcon from "@mui/icons-material/Grass";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import CameraOutdoorIcon from "@mui/icons-material/CameraOutdoor";
import SecurityIcon from "@mui/icons-material/Security";
import LockIcon from "@mui/icons-material/Lock";
import DoorFrontIcon from "@mui/icons-material/DoorFront";
import GarageIcon from "@mui/icons-material/Garage";
import YardIcon from "@mui/icons-material/Yard";
import PoolIcon from "@mui/icons-material/Pool";
import DeckIcon from "@mui/icons-material/Deck";
import StairsIcon from "@mui/icons-material/Stairs";
import ApartmentIcon from "@mui/icons-material/Apartment";
import CottageIcon from "@mui/icons-material/Cottage";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import StorefrontIcon from "@mui/icons-material/Storefront";
import DiningIcon from "@mui/icons-material/Dining";
import ChairIcon from "@mui/icons-material/Chair";
import BedIcon from "@mui/icons-material/Bed";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import PetsIcon from "@mui/icons-material/Pets";
import LocalLaundryServiceIcon from "@mui/icons-material/LocalLaundryService";
import TvIcon from "@mui/icons-material/Tv";
import SpeakerIcon from "@mui/icons-material/Speaker";
import RouterIcon from "@mui/icons-material/Router";
import CloudIcon from "@mui/icons-material/Cloud";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import AirIcon from "@mui/icons-material/Air";
import OpacityIcon from "@mui/icons-material/Opacity";
import ElectricMeterIcon from "@mui/icons-material/ElectricMeter";
import SolarPowerIcon from "@mui/icons-material/SolarPower";
import EvStationIcon from "@mui/icons-material/EvStation";
import WaterIcon from "@mui/icons-material/Water";
import FireplaceIcon from "@mui/icons-material/Fireplace";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SettingsIcon from "@mui/icons-material/Settings";
import TuneIcon from "@mui/icons-material/Tune";
import TimelineIcon from "@mui/icons-material/Timeline";
import BarChartIcon from "@mui/icons-material/BarChart";
import MapIcon from "@mui/icons-material/Map";
import PlaceIcon from "@mui/icons-material/Place";
import GarageOutlinedIcon from "@mui/icons-material/GarageOutlined";
import BalconyIcon from "@mui/icons-material/Balcony";
import RoofingIcon from "@mui/icons-material/Roofing";
import FenceIcon from "@mui/icons-material/Fence";

export type DashboardIconComponent = ComponentType<SvgIconProps>;

export const DEFAULT_DASHBOARD_TAB_ICON = "dashboard";
export const DEFAULT_SECTION_ICON = "view-module";

export const DASHBOARD_ICONS: {
  id: string;
  label: string;
  Icon: DashboardIconComponent;
}[] = [
  // General
  { id: "dashboard", label: "Dashboard", Icon: DashboardIcon },
  { id: "view-module", label: "Section", Icon: ViewModuleIcon },
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "star", label: "Favourite", Icon: StarIcon },
  { id: "heart", label: "Health", Icon: FavoriteIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
  { id: "tune", label: "Controls", Icon: TuneIcon },
  // Rooms / building
  { id: "sofa", label: "Living room", Icon: WeekendIcon },
  { id: "chair", label: "Lounge", Icon: ChairIcon },
  { id: "bed", label: "Bedroom", Icon: HotelIcon },
  { id: "bed-alt", label: "Bed", Icon: BedIcon },
  { id: "kitchen", label: "Kitchen", Icon: KitchenIcon },
  { id: "dining", label: "Dining", Icon: DiningIcon },
  { id: "bath", label: "Bathroom", Icon: BathtubIcon },
  { id: "laundry", label: "Laundry", Icon: LocalLaundryServiceIcon },
  { id: "nursery", label: "Nursery", Icon: ChildCareIcon },
  { id: "office", label: "Office", Icon: ComputerIcon },
  { id: "door", label: "Room", Icon: MeetingRoomIcon },
  { id: "door-front", label: "Entrance", Icon: DoorFrontIcon },
  { id: "stairs", label: "Stairs", Icon: StairsIcon },
  { id: "apartment", label: "Apartment", Icon: ApartmentIcon },
  { id: "cottage", label: "Cottage", Icon: CottageIcon },
  { id: "warehouse", label: "Utility", Icon: WarehouseIcon },
  { id: "store", label: "Shop", Icon: StorefrontIcon },
  { id: "balcony", label: "Balcony", Icon: BalconyIcon },
  { id: "roof", label: "Attic / roof", Icon: RoofingIcon },
  // Outdoor / vehicles
  { id: "garage", label: "Garage", Icon: DirectionsCarIcon },
  { id: "garage-door", label: "Garage door", Icon: GarageIcon },
  { id: "garage-outline", label: "Car port", Icon: GarageOutlinedIcon },
  { id: "garden", label: "Garden", Icon: ParkIcon },
  { id: "yard", label: "Yard", Icon: YardIcon },
  { id: "grass", label: "Lawn", Icon: GrassIcon },
  { id: "fence", label: "Fence / gate", Icon: FenceIcon },
  { id: "deck", label: "Patio / deck", Icon: DeckIcon },
  { id: "pool", label: "Pool", Icon: PoolIcon },
  { id: "pets", label: "Pets", Icon: PetsIcon },
  { id: "map", label: "Map", Icon: MapIcon },
  { id: "place", label: "Location", Icon: PlaceIcon },
  // CCTV / security
  { id: "cctv", label: "CCTV", Icon: VideocamIcon },
  { id: "camera", label: "Camera", Icon: VideocamOutlinedIcon },
  { id: "camera-outdoor", label: "Outdoor cam", Icon: CameraOutdoorIcon },
  { id: "security", label: "Security", Icon: SecurityIcon },
  { id: "lock", label: "Lock", Icon: LockIcon },
  { id: "alarm", label: "Alarm", Icon: NotificationsActiveIcon },
  { id: "warning", label: "Alert", Icon: WarningAmberIcon },
  // Climate / water / power
  { id: "thermostat", label: "Climate", Icon: ThermostatIcon },
  { id: "ac", label: "Air con", Icon: AcUnitIcon },
  { id: "heat", label: "Heating", Icon: WhatshotIcon },
  { id: "fireplace", label: "Fireplace", Icon: FireplaceIcon },
  { id: "air", label: "Air quality", Icon: AirIcon },
  { id: "humidity", label: "Humidity", Icon: WaterDropIcon },
  { id: "water", label: "Water", Icon: WaterIcon },
  { id: "opacity", label: "Moisture", Icon: OpacityIcon },
  { id: "gauge", label: "Sensors", Icon: SpeedIcon },
  { id: "sensors", label: "Live", Icon: SensorsIcon },
  { id: "power", label: "Power", Icon: BoltIcon },
  { id: "meter", label: "Energy meter", Icon: ElectricMeterIcon },
  { id: "solar", label: "Solar", Icon: SolarPowerIcon },
  { id: "ev", label: "EV charger", Icon: EvStationIcon },
  // Network / media / lights
  { id: "wifi", label: "Network", Icon: WifiIcon },
  { id: "router", label: "Router", Icon: RouterIcon },
  { id: "cloud", label: "Cloud", Icon: CloudIcon },
  { id: "devices", label: "Devices", Icon: MemoryIcon },
  { id: "lights", label: "Lights", Icon: LightbulbIcon },
  { id: "tv", label: "TV / media", Icon: TvIcon },
  { id: "speaker", label: "Audio", Icon: SpeakerIcon },
  { id: "sun", label: "Day", Icon: WbSunnyIcon },
  { id: "moon", label: "Night", Icon: DarkModeIcon },
  // Charts
  { id: "timeline", label: "Timeline", Icon: TimelineIcon },
  { id: "chart", label: "Charts", Icon: BarChartIcon },
];

export function getDashboardIcon(iconId?: string | null): DashboardIconComponent {
  const found = DASHBOARD_ICONS.find((i) => i.id === iconId);
  return found?.Icon ?? DashboardIcon;
}
