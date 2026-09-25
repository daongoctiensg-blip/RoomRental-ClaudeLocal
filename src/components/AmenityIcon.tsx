import {
  AirVent,
  ThermometerSun,
  Refrigerator,
  WashingMachine,
  ArrowUpDown,
  CircleParking,
  Wifi,
  CookingPot,
  BedDouble,
  Sofa,
  Shirt,
  Bath,
  Tv,
  ShieldCheck,
  Cctv,
  KeyRound,
  Sparkles,
  Sun,
  Dog,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";

// Round 12: icons are now picked per catalog item by the admin (from the
// fixed AMENITY_ICON_OPTIONS list in src/lib/amenities.ts) instead of being
// hardcoded per keyword. Same amenity -> same icon everywhere it appears.
// Keys must stay in sync with AMENITY_ICON_OPTIONS; an unknown key falls back
// to the default check icon rather than rendering nothing.
const ICONS: Record<string, LucideIcon> = {
  check: CircleCheck,
  "air-vent": AirVent,
  thermometer: ThermometerSun,
  refrigerator: Refrigerator,
  "washing-machine": WashingMachine,
  elevator: ArrowUpDown,
  parking: CircleParking,
  wifi: Wifi,
  "cooking-pot": CookingPot,
  bed: BedDouble,
  sofa: Sofa,
  shirt: Shirt,
  bath: Bath,
  tv: Tv,
  shield: ShieldCheck,
  camera: Cctv,
  key: KeyRound,
  sparkles: Sparkles,
  sun: Sun,
  dog: Dog,
};

export function AmenityIcon({ icon, className }: { icon?: string; className?: string }) {
  const Icon = (icon && ICONS[icon]) || CircleCheck;
  return <Icon className={className} aria-hidden />;
}
