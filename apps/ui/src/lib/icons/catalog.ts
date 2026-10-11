/**
 * Icons a reading or panel item can use (Settings → Devices → reading, and panel editors).
 * Loaded on demand — only when a chosen icon or the icon picker is shown.
 * Ids are stored in the database: never rename one, only add new ones.
 */
import type { SvgIconComponent } from "@mui/icons-material";
import DeviceThermostatIcon from "@mui/icons-material/DeviceThermostat";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import HeatPumpIcon from "@mui/icons-material/HeatPump";
import HvacIcon from "@mui/icons-material/Hvac";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import SevereColdIcon from "@mui/icons-material/SevereCold";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import AirIcon from "@mui/icons-material/Air";
import WindPowerIcon from "@mui/icons-material/WindPower";
import ModeFanOffIcon from "@mui/icons-material/ModeFanOff";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import OpacityIcon from "@mui/icons-material/Opacity";
import Co2Icon from "@mui/icons-material/Co2";
import GrainIcon from "@mui/icons-material/Grain";
import MasksIcon from "@mui/icons-material/Masks";
import DehazeIcon from "@mui/icons-material/Dehaze";
import CloudIcon from "@mui/icons-material/Cloud";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import ThunderstormIcon from "@mui/icons-material/Thunderstorm";
import StormIcon from "@mui/icons-material/Storm";
import UmbrellaIcon from "@mui/icons-material/Umbrella";
import CompressIcon from "@mui/icons-material/Compress";
import SpeedIcon from "@mui/icons-material/Speed";
import BoltIcon from "@mui/icons-material/Bolt";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import ElectricMeterIcon from "@mui/icons-material/ElectricMeter";
import PowerIcon from "@mui/icons-material/Power";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import OutletIcon from "@mui/icons-material/Outlet";
import ElectricalServicesIcon from "@mui/icons-material/ElectricalServices";
import CableIcon from "@mui/icons-material/Cable";
import Battery5BarIcon from "@mui/icons-material/Battery5Bar";
import BatteryChargingFullIcon from "@mui/icons-material/BatteryChargingFull";
import SolarPowerIcon from "@mui/icons-material/SolarPower";
import EnergySavingsLeafIcon from "@mui/icons-material/EnergySavingsLeaf";
import EvStationIcon from "@mui/icons-material/EvStation";
import ElectricCarIcon from "@mui/icons-material/ElectricCar";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import GasMeterIcon from "@mui/icons-material/GasMeter";
import PropaneIcon from "@mui/icons-material/Propane";
import OilBarrelIcon from "@mui/icons-material/OilBarrel";
import SavingsIcon from "@mui/icons-material/Savings";
import CurrencyPoundIcon from "@mui/icons-material/CurrencyPound";
import EuroIcon from "@mui/icons-material/Euro";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import LightIcon from "@mui/icons-material/Light";
import WbIncandescentIcon from "@mui/icons-material/WbIncandescent";
import EmojiObjectsIcon from "@mui/icons-material/EmojiObjects";
import HighlightIcon from "@mui/icons-material/Highlight";
import FlashlightOnIcon from "@mui/icons-material/FlashlightOn";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import NightlightIcon from "@mui/icons-material/Nightlight";
import Brightness6Icon from "@mui/icons-material/Brightness6";
import PaletteIcon from "@mui/icons-material/Palette";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import WallpaperIcon from "@mui/icons-material/Wallpaper";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import KeyIcon from "@mui/icons-material/Key";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import ShieldIcon from "@mui/icons-material/Shield";
import SecurityIcon from "@mui/icons-material/Security";
import PolicyIcon from "@mui/icons-material/Policy";
import VideocamIcon from "@mui/icons-material/Videocam";
import CameraOutdoorIcon from "@mui/icons-material/CameraOutdoor";
import CameraIndoorIcon from "@mui/icons-material/CameraIndoor";
import DoorbellIcon from "@mui/icons-material/Doorbell";
import DoorFrontIcon from "@mui/icons-material/DoorFront";
import DoorBackIcon from "@mui/icons-material/DoorBack";
import DoorSlidingIcon from "@mui/icons-material/DoorSliding";
import SensorDoorIcon from "@mui/icons-material/SensorDoor";
import SensorWindowIcon from "@mui/icons-material/SensorWindow";
import SensorsIcon from "@mui/icons-material/Sensors";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import VisibilityIcon from "@mui/icons-material/Visibility";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import AlarmIcon from "@mui/icons-material/Alarm";
import WarningIcon from "@mui/icons-material/Warning";
import FireplaceIcon from "@mui/icons-material/Fireplace";
import WaterIcon from "@mui/icons-material/Water";
import WaterDamageIcon from "@mui/icons-material/WaterDamage";
import ShowerIcon from "@mui/icons-material/Shower";
import BathtubIcon from "@mui/icons-material/Bathtub";
import HotTubIcon from "@mui/icons-material/HotTub";
import PoolIcon from "@mui/icons-material/Pool";
import PlumbingIcon from "@mui/icons-material/Plumbing";
import LocalDrinkIcon from "@mui/icons-material/LocalDrink";
import YardIcon from "@mui/icons-material/Yard";
import GrassIcon from "@mui/icons-material/Grass";
import ParkIcon from "@mui/icons-material/Park";
import LocalFloristIcon from "@mui/icons-material/LocalFlorist";
import FenceIcon from "@mui/icons-material/Fence";
import PetsIcon from "@mui/icons-material/Pets";
import HomeIcon from "@mui/icons-material/Home";
import HouseIcon from "@mui/icons-material/House";
import CottageIcon from "@mui/icons-material/Cottage";
import CabinIcon from "@mui/icons-material/Cabin";
import ApartmentIcon from "@mui/icons-material/Apartment";
import GarageIcon from "@mui/icons-material/Garage";
import LivingIcon from "@mui/icons-material/Living";
import WeekendIcon from "@mui/icons-material/Weekend";
import ChairIcon from "@mui/icons-material/Chair";
import BedIcon from "@mui/icons-material/Bed";
import BedroomParentIcon from "@mui/icons-material/BedroomParent";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import CribIcon from "@mui/icons-material/Crib";
import ToysIcon from "@mui/icons-material/Toys";
import KitchenIcon from "@mui/icons-material/Kitchen";
import DiningIcon from "@mui/icons-material/Dining";
import CountertopsIcon from "@mui/icons-material/Countertops";
import BathroomIcon from "@mui/icons-material/Bathroom";
import WcIcon from "@mui/icons-material/Wc";
import StairsIcon from "@mui/icons-material/Stairs";
import BalconyIcon from "@mui/icons-material/Balcony";
import DeckIcon from "@mui/icons-material/Deck";
import RoofingIcon from "@mui/icons-material/Roofing";
import WindowIcon from "@mui/icons-material/Window";
import FoundationIcon from "@mui/icons-material/Foundation";
import SchoolIcon from "@mui/icons-material/School";
import WorkIcon from "@mui/icons-material/Work";
import DeskIcon from "@mui/icons-material/Desk";
import TvIcon from "@mui/icons-material/Tv";
import MicrowaveIcon from "@mui/icons-material/Microwave";
import BlenderIcon from "@mui/icons-material/Blender";
import CoffeeMakerIcon from "@mui/icons-material/CoffeeMaker";
import CoffeeIcon from "@mui/icons-material/Coffee";
import LocalLaundryServiceIcon from "@mui/icons-material/LocalLaundryService";
import IronIcon from "@mui/icons-material/Iron";
import DryCleaningIcon from "@mui/icons-material/DryCleaning";
import BlindsIcon from "@mui/icons-material/Blinds";
import CurtainsIcon from "@mui/icons-material/Curtains";
import RollerShadesIcon from "@mui/icons-material/RollerShades";
import SpeakerIcon from "@mui/icons-material/Speaker";
import RadioIcon from "@mui/icons-material/Radio";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import RouterIcon from "@mui/icons-material/Router";
import WifiIcon from "@mui/icons-material/Wifi";
import ComputerIcon from "@mui/icons-material/Computer";
import LaptopIcon from "@mui/icons-material/Laptop";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import TabletIcon from "@mui/icons-material/Tablet";
import PrintIcon from "@mui/icons-material/Print";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import MemoryIcon from "@mui/icons-material/Memory";
import SettingsIcon from "@mui/icons-material/Settings";
import LocalCarWashIcon from "@mui/icons-material/LocalCarWash";
import StarIcon from "@mui/icons-material/Star";
import FavoriteIcon from "@mui/icons-material/Favorite";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import FlagIcon from "@mui/icons-material/Flag";
import LabelIcon from "@mui/icons-material/Label";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TimerIcon from "@mui/icons-material/Timer";
import EventIcon from "@mui/icons-material/Event";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PersonIcon from "@mui/icons-material/Person";
import PeopleIcon from "@mui/icons-material/People";
import GroupsIcon from "@mui/icons-material/Groups";
import InfoIcon from "@mui/icons-material/Info";
import HelpIcon from "@mui/icons-material/Help";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import TuneIcon from "@mui/icons-material/Tune";
import NumbersIcon from "@mui/icons-material/Numbers";
import NotesIcon from "@mui/icons-material/Notes";
import PlaceIcon from "@mui/icons-material/Place";
import PublicIcon from "@mui/icons-material/Public";
import ExploreIcon from "@mui/icons-material/Explore";
import CircleIcon from "@mui/icons-material/Circle";
import SquareIcon from "@mui/icons-material/Square";
import HexagonIcon from "@mui/icons-material/Hexagon";

export type IconEntry = { id: string; label: string; group: string; Icon: SvgIconComponent };

export const ICON_CATALOG: IconEntry[] = [
  { id: "device-thermostat", label: "Thermometer", group: "Climate", Icon: DeviceThermostatIcon },
  { id: "thermostat", label: "Thermostat", group: "Climate", Icon: ThermostatIcon },
  { id: "heat-pump", label: "Heat pump", group: "Climate", Icon: HeatPumpIcon },
  { id: "hvac", label: "Hvac", group: "Climate", Icon: HvacIcon },
  { id: "ac-unit", label: "Snowflake", group: "Climate", Icon: AcUnitIcon },
  { id: "severe-cold", label: "Cold", group: "Climate", Icon: SevereColdIcon },
  { id: "whatshot", label: "Heat", group: "Climate", Icon: WhatshotIcon },
  { id: "air", label: "Air", group: "Climate", Icon: AirIcon },
  { id: "wind-power", label: "Wind turbine", group: "Climate", Icon: WindPowerIcon },
  { id: "mode-fan-off", label: "Fan off", group: "Climate", Icon: ModeFanOffIcon },
  { id: "water-drop", label: "Droplet", group: "Climate", Icon: WaterDropIcon },
  { id: "opacity", label: "Humidity", group: "Climate", Icon: OpacityIcon },
  { id: "co2", label: "CO₂", group: "Climate", Icon: Co2Icon },
  { id: "grain", label: "Particles", group: "Climate", Icon: GrainIcon },
  { id: "masks", label: "Air quality", group: "Climate", Icon: MasksIcon },
  { id: "dehaze", label: "Haze", group: "Climate", Icon: DehazeIcon },
  { id: "cloud", label: "Cloud", group: "Climate", Icon: CloudIcon },
  { id: "wb-sunny", label: "Sun", group: "Climate", Icon: WbSunnyIcon },
  { id: "thunderstorm", label: "Thunderstorm", group: "Climate", Icon: ThunderstormIcon },
  { id: "storm", label: "Storm", group: "Climate", Icon: StormIcon },
  { id: "umbrella", label: "Umbrella", group: "Climate", Icon: UmbrellaIcon },
  { id: "compress", label: "Pressure", group: "Climate", Icon: CompressIcon },
  { id: "speed", label: "Gauge", group: "Climate", Icon: SpeedIcon },
  { id: "bolt", label: "Lightning", group: "Energy", Icon: BoltIcon },
  { id: "electric-bolt", label: "Electric", group: "Energy", Icon: ElectricBoltIcon },
  { id: "electric-meter", label: "Electricity meter", group: "Energy", Icon: ElectricMeterIcon },
  { id: "power", label: "Plug", group: "Energy", Icon: PowerIcon },
  { id: "power-settings-new", label: "Power", group: "Energy", Icon: PowerSettingsNewIcon },
  { id: "outlet", label: "Socket", group: "Energy", Icon: OutletIcon },
  { id: "electrical-services", label: "Wiring", group: "Energy", Icon: ElectricalServicesIcon },
  { id: "cable", label: "Cable", group: "Energy", Icon: CableIcon },
  { id: "battery5-bar", label: "Battery", group: "Energy", Icon: Battery5BarIcon },
  { id: "battery-charging-full", label: "Charging", group: "Energy", Icon: BatteryChargingFullIcon },
  { id: "solar-power", label: "Solar panel", group: "Energy", Icon: SolarPowerIcon },
  { id: "energy-savings-leaf", label: "Eco", group: "Energy", Icon: EnergySavingsLeafIcon },
  { id: "ev-station", label: "EV charger", group: "Energy", Icon: EvStationIcon },
  { id: "electric-car", label: "Electric car", group: "Energy", Icon: ElectricCarIcon },
  { id: "gas", label: "Gas / flame", group: "Energy", Icon: LocalFireDepartmentIcon },
  { id: "gas-meter", label: "Gas meter", group: "Energy", Icon: GasMeterIcon },
  { id: "propane", label: "Propane", group: "Energy", Icon: PropaneIcon },
  { id: "oil-barrel", label: "Oil", group: "Energy", Icon: OilBarrelIcon },
  { id: "savings", label: "Savings", group: "Energy", Icon: SavingsIcon },
  { id: "currency-pound", label: "Pound", group: "Energy", Icon: CurrencyPoundIcon },
  { id: "euro", label: "Euro", group: "Energy", Icon: EuroIcon },
  { id: "attach-money", label: "Dollar", group: "Energy", Icon: AttachMoneyIcon },
  { id: "lightbulb", label: "Lightbulb", group: "Lighting", Icon: LightbulbIcon },
  { id: "lightbulb-outlined", label: "Lightbulb (outline)", group: "Lighting", Icon: LightbulbOutlinedIcon },
  { id: "light", label: "Ceiling light", group: "Lighting", Icon: LightIcon },
  { id: "wb-incandescent", label: "Lamp", group: "Lighting", Icon: WbIncandescentIcon },
  { id: "emoji-objects", label: "Idea bulb", group: "Lighting", Icon: EmojiObjectsIcon },
  { id: "highlight", label: "Spotlight", group: "Lighting", Icon: HighlightIcon },
  { id: "flashlight-on", label: "Torch", group: "Lighting", Icon: FlashlightOnIcon },
  { id: "tips-and-updates", label: "Smart bulb", group: "Lighting", Icon: TipsAndUpdatesIcon },
  { id: "light-mode", label: "Daylight", group: "Lighting", Icon: LightModeIcon },
  { id: "dark-mode", label: "Night", group: "Lighting", Icon: DarkModeIcon },
  { id: "nightlight", label: "Night light", group: "Lighting", Icon: NightlightIcon },
  { id: "brightness6", label: "Brightness", group: "Lighting", Icon: Brightness6Icon },
  { id: "palette", label: "Palette", group: "Lighting", Icon: PaletteIcon },
  { id: "color-lens", label: "Colours", group: "Lighting", Icon: ColorLensIcon },
  { id: "wallpaper", label: "Scene", group: "Lighting", Icon: WallpaperIcon },
  { id: "lock", label: "Lock", group: "Security", Icon: LockIcon },
  { id: "lock-open", label: "Unlocked", group: "Security", Icon: LockOpenIcon },
  { id: "key", label: "Key", group: "Security", Icon: KeyIcon },
  { id: "fingerprint", label: "Fingerprint", group: "Security", Icon: FingerprintIcon },
  { id: "shield", label: "Shield", group: "Security", Icon: ShieldIcon },
  { id: "security", label: "Security", group: "Security", Icon: SecurityIcon },
  { id: "policy", label: "Inspection", group: "Security", Icon: PolicyIcon },
  { id: "videocam", label: "Camera", group: "Security", Icon: VideocamIcon },
  { id: "camera-outdoor", label: "Outdoor camera", group: "Security", Icon: CameraOutdoorIcon },
  { id: "camera-indoor", label: "Indoor camera", group: "Security", Icon: CameraIndoorIcon },
  { id: "doorbell", label: "Doorbell", group: "Security", Icon: DoorbellIcon },
  { id: "door-front", label: "Front door", group: "Security", Icon: DoorFrontIcon },
  { id: "door-back", label: "Back door", group: "Security", Icon: DoorBackIcon },
  { id: "door-sliding", label: "Sliding door", group: "Security", Icon: DoorSlidingIcon },
  { id: "sensor-door", label: "Door sensor", group: "Security", Icon: SensorDoorIcon },
  { id: "sensor-window", label: "Window sensor", group: "Security", Icon: SensorWindowIcon },
  { id: "sensors", label: "Sensor", group: "Security", Icon: SensorsIcon },
  { id: "directions-run", label: "Motion", group: "Security", Icon: DirectionsRunIcon },
  { id: "visibility", label: "Visibility", group: "Security", Icon: VisibilityIcon },
  { id: "notifications-active", label: "Alert", group: "Security", Icon: NotificationsActiveIcon },
  { id: "alarm", label: "Alarm", group: "Security", Icon: AlarmIcon },
  { id: "warning", label: "Warning", group: "Security", Icon: WarningIcon },
  { id: "fireplace", label: "Fireplace", group: "Security", Icon: FireplaceIcon },
  { id: "water", label: "Water", group: "Water & garden", Icon: WaterIcon },
  { id: "water-damage", label: "Leak", group: "Water & garden", Icon: WaterDamageIcon },
  { id: "shower", label: "Shower", group: "Water & garden", Icon: ShowerIcon },
  { id: "bathtub", label: "Bathtub", group: "Water & garden", Icon: BathtubIcon },
  { id: "hot-tub", label: "Hot tub", group: "Water & garden", Icon: HotTubIcon },
  { id: "pool", label: "Pool", group: "Water & garden", Icon: PoolIcon },
  { id: "plumbing", label: "Plumbing", group: "Water & garden", Icon: PlumbingIcon },
  { id: "local-drink", label: "Drinking water", group: "Water & garden", Icon: LocalDrinkIcon },
  { id: "yard", label: "Garden", group: "Water & garden", Icon: YardIcon },
  { id: "grass", label: "Grass", group: "Water & garden", Icon: GrassIcon },
  { id: "park", label: "Tree", group: "Water & garden", Icon: ParkIcon },
  { id: "local-florist", label: "Flower", group: "Water & garden", Icon: LocalFloristIcon },
  { id: "fence", label: "Fence", group: "Water & garden", Icon: FenceIcon },
  { id: "pets", label: "Pets", group: "Water & garden", Icon: PetsIcon },
  { id: "home", label: "Home", group: "Rooms", Icon: HomeIcon },
  { id: "house", label: "House", group: "Rooms", Icon: HouseIcon },
  { id: "cottage", label: "Cottage", group: "Rooms", Icon: CottageIcon },
  { id: "cabin", label: "Cabin", group: "Rooms", Icon: CabinIcon },
  { id: "apartment", label: "Apartment", group: "Rooms", Icon: ApartmentIcon },
  { id: "garage", label: "Garage", group: "Rooms", Icon: GarageIcon },
  { id: "living", label: "Living room", group: "Rooms", Icon: LivingIcon },
  { id: "weekend", label: "Sofa", group: "Rooms", Icon: WeekendIcon },
  { id: "chair", label: "Chair", group: "Rooms", Icon: ChairIcon },
  { id: "bed", label: "Bed", group: "Rooms", Icon: BedIcon },
  { id: "bedroom-parent", label: "Bedroom", group: "Rooms", Icon: BedroomParentIcon },
  { id: "child-care", label: "Nursery", group: "Rooms", Icon: ChildCareIcon },
  { id: "crib", label: "Crib", group: "Rooms", Icon: CribIcon },
  { id: "toys", label: "Toys", group: "Rooms", Icon: ToysIcon },
  { id: "kitchen", label: "Kitchen", group: "Rooms", Icon: KitchenIcon },
  { id: "dining", label: "Dining", group: "Rooms", Icon: DiningIcon },
  { id: "countertops", label: "Worktop", group: "Rooms", Icon: CountertopsIcon },
  { id: "bathroom", label: "Bathroom", group: "Rooms", Icon: BathroomIcon },
  { id: "toilet", label: "Toilet", group: "Rooms", Icon: WcIcon },
  { id: "stairs", label: "Stairs", group: "Rooms", Icon: StairsIcon },
  { id: "balcony", label: "Balcony", group: "Rooms", Icon: BalconyIcon },
  { id: "deck", label: "Deck", group: "Rooms", Icon: DeckIcon },
  { id: "roofing", label: "Roof", group: "Rooms", Icon: RoofingIcon },
  { id: "window", label: "Window", group: "Rooms", Icon: WindowIcon },
  { id: "foundation", label: "Building", group: "Rooms", Icon: FoundationIcon },
  { id: "school", label: "Study", group: "Rooms", Icon: SchoolIcon },
  { id: "work", label: "Office", group: "Rooms", Icon: WorkIcon },
  { id: "desk", label: "Desk", group: "Rooms", Icon: DeskIcon },
  { id: "tv", label: "TV", group: "Appliances", Icon: TvIcon },
  { id: "microwave", label: "Microwave", group: "Appliances", Icon: MicrowaveIcon },
  { id: "blender", label: "Blender", group: "Appliances", Icon: BlenderIcon },
  { id: "coffee-maker", label: "Coffee machine", group: "Appliances", Icon: CoffeeMakerIcon },
  { id: "coffee", label: "Coffee", group: "Appliances", Icon: CoffeeIcon },
  { id: "local-laundry-service", label: "Washing machine", group: "Appliances", Icon: LocalLaundryServiceIcon },
  { id: "iron", label: "Iron", group: "Appliances", Icon: IronIcon },
  { id: "dry-cleaning", label: "Clothes", group: "Appliances", Icon: DryCleaningIcon },
  { id: "blinds", label: "Blinds", group: "Appliances", Icon: BlindsIcon },
  { id: "curtains", label: "Curtains", group: "Appliances", Icon: CurtainsIcon },
  { id: "roller-shades", label: "Shades", group: "Appliances", Icon: RollerShadesIcon },
  { id: "speaker", label: "Speaker", group: "Appliances", Icon: SpeakerIcon },
  { id: "radio", label: "Radio", group: "Appliances", Icon: RadioIcon },
  { id: "headphones", label: "Headphones", group: "Appliances", Icon: HeadphonesIcon },
  { id: "sports-esports", label: "Games console", group: "Appliances", Icon: SportsEsportsIcon },
  { id: "router", label: "Router", group: "Appliances", Icon: RouterIcon },
  { id: "wifi", label: "Wifi", group: "Appliances", Icon: WifiIcon },
  { id: "computer", label: "Computer", group: "Appliances", Icon: ComputerIcon },
  { id: "laptop", label: "Laptop", group: "Appliances", Icon: LaptopIcon },
  { id: "phone-iphone", label: "Phone", group: "Appliances", Icon: PhoneIphoneIcon },
  { id: "tablet", label: "Tablet", group: "Appliances", Icon: TabletIcon },
  { id: "print", label: "Printer", group: "Appliances", Icon: PrintIcon },
  { id: "smart-toy", label: "Robot", group: "Appliances", Icon: SmartToyIcon },
  { id: "memory", label: "Chip", group: "Appliances", Icon: MemoryIcon },
  { id: "settings", label: "Settings", group: "Appliances", Icon: SettingsIcon },
  { id: "local-car-wash", label: "Car wash", group: "Appliances", Icon: LocalCarWashIcon },
  { id: "star", label: "Star", group: "General", Icon: StarIcon },
  { id: "favorite", label: "Heart", group: "General", Icon: FavoriteIcon },
  { id: "bookmark", label: "Bookmark", group: "General", Icon: BookmarkIcon },
  { id: "flag", label: "Flag", group: "General", Icon: FlagIcon },
  { id: "label", label: "Label", group: "General", Icon: LabelIcon },
  { id: "schedule", label: "Clock", group: "General", Icon: ScheduleIcon },
  { id: "timer", label: "Timer", group: "General", Icon: TimerIcon },
  { id: "event", label: "Event", group: "General", Icon: EventIcon },
  { id: "calendar-month", label: "Calendar", group: "General", Icon: CalendarMonthIcon },
  { id: "person", label: "Person", group: "General", Icon: PersonIcon },
  { id: "people", label: "People", group: "General", Icon: PeopleIcon },
  { id: "groups", label: "Family", group: "General", Icon: GroupsIcon },
  { id: "info", label: "Info", group: "General", Icon: InfoIcon },
  { id: "help", label: "Help", group: "General", Icon: HelpIcon },
  { id: "check-circle", label: "OK", group: "General", Icon: CheckCircleIcon },
  { id: "cancel", label: "Stop", group: "General", Icon: CancelIcon },
  { id: "toggle-on", label: "Toggle", group: "General", Icon: ToggleOnIcon },
  { id: "tune", label: "Adjust", group: "General", Icon: TuneIcon },
  { id: "numbers", label: "Number", group: "General", Icon: NumbersIcon },
  { id: "notes", label: "Text", group: "General", Icon: NotesIcon },
  { id: "place", label: "Location", group: "General", Icon: PlaceIcon },
  { id: "public", label: "World", group: "General", Icon: PublicIcon },
  { id: "explore", label: "Compass", group: "General", Icon: ExploreIcon },
  { id: "circle", label: "Circle", group: "General", Icon: CircleIcon },
  { id: "square", label: "Square", group: "General", Icon: SquareIcon },
  { id: "hexagon", label: "Hexagon", group: "General", Icon: HexagonIcon },
];

export const ICON_GROUPS = [...new Set(ICON_CATALOG.map((e) => e.group))];

const BY_ID = new Map(ICON_CATALOG.map((e) => [e.id, e]));

export function iconById(id: string | null | undefined): IconEntry | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}
