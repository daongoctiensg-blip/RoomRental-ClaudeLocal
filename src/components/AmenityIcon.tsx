import {
  AirVent,
  ThermometerSun,
  Refrigerator,
  WashingMachine,
  ArrowUpDown,
  CircleParking,
  Wifi,
  CookingPot,
  type LucideIcon,
} from "lucide-react";
import type { CommonAmenityKeyword } from "@/lib/amenityKeywords";

// Round 11 UI refresh: one icon per "Tiện ích phổ biến" keyword, reused by
// both RoomCard's quick tags (homepage) and AmenityGrid (room detail page)
// so the same amenity always gets the same icon everywhere it appears.
const AMENITY_ICON_MAP: Record<CommonAmenityKeyword, LucideIcon> = {
  "Máy lạnh": AirVent,
  "Nóng lạnh": ThermometerSun,
  "Tủ lạnh": Refrigerator,
  "Máy giặt": WashingMachine,
  "Thang máy": ArrowUpDown,
  "Chỗ để xe": CircleParking,
  Wifi: Wifi,
  Bếp: CookingPot,
};

export function AmenityIcon({
  keyword,
  className,
}: {
  keyword: CommonAmenityKeyword;
  className?: string;
}) {
  const Icon = AMENITY_ICON_MAP[keyword];
  return <Icon className={className} aria-hidden />;
}
