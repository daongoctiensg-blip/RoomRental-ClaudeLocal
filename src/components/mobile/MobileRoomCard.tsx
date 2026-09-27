import Link from "next/link";
import type { RoomWithProperty } from "@/types";
import RoomPhoto from "@/components/RoomPhoto";
import StatusBadge from "@/components/StatusBadge";
import SaveRoomButton from "@/components/SaveRoomButton";
import { formatVnd } from "@/lib/format";
import { type Amenity, effectiveAmenities, normalizeAmenityName } from "@/lib/amenities";

const NEW_LISTING_DAYS = 7;
function isNewListing(createdAt: string): boolean {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs >= 0 && ageMs <= NEW_LISTING_DAYS * 24 * 60 * 60 * 1000;
}

/** "CHDV Lô C6, Khu dân cư Nam Long" + "Phường Phú Thuận" →
 * "CHDV Lô C6 · P. Phú Thuận" — fits one line on a phone. */
function shortLocation(name: string, ward: string): string {
  const building = name.split(",")[0].trim();
  const w = ward.replace(/^Phường\s+/i, "P. ").replace(/^Xã\s+/i, "X. ").trim();
  return w ? `${building} · ${w}` : building;
}

/**
 * Compact horizontal room card for < md screens — round 13, trip.com style
 * (Claude Design board "1 · Trang chủ"): photo frame on the left (fixed
 * 124×132, object-contain per the owner's "fix trong khung"), facts on the
 * right, price bottom-right. The whole card opens the room; the heart sits
 * outside the link so tapping it never navigates.
 */
export default function MobileRoomCard({
  room,
  catalog,
  showStatus,
}: {
  room: RoomWithProperty;
  catalog: Amenity[];
  /** Show the status badge (only when the list isn't all "Còn trống"). */
  showStatus: boolean;
}) {
  const roomKeys = new Set(
    effectiveAmenities(room, room.property.amenitiesShared).map(normalizeAmenityName)
  );
  const popular = catalog
    .filter((a) => a.isPopular && roomKeys.has(normalizeAmenityName(a.name)))
    .slice(0, 3)
    .map((a) => a.name);
  const meta = [
    `${room.areaSqm} m²`,
    room.hasBalcony ? "Ban công" : null,
    room.subUnits && room.subUnits.length > 0 ? `${room.subUnits.length} phòng ngủ` : null,
    room.maxOccupancy ? `${room.maxOccupancy} người` : null,
  ].filter(Boolean);

  return (
    <div className="relative">
      <Link
        href={`/rooms/${room.id}`}
        className="flex gap-2.5 rounded-[14px] border border-[#e8ebf1] bg-white p-2 text-[#16233b]"
      >
        <span className="relative flex h-[132px] w-[124px] flex-none items-center justify-center overflow-hidden rounded-[10px] bg-[#e9edf3] text-[11px] text-[#6b7588]">
          <RoomPhoto
            src={room.images[0]}
            alt={`Ảnh phòng ${room.code}`}
            className="block h-full w-full object-contain"
          />
          {isNewListing(room.createdAt) ? (
            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-[#15803d] px-1.5 py-0.5 text-[10px] font-bold text-white">
              Mới đăng
            </span>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-grow flex-col gap-1 pr-0.5 pt-0.5">
          <span className="text-base font-bold leading-tight">
            Phòng {room.code}
            {room.floor ? (
              <span className="text-[13px] font-normal text-[#5b6475]"> · {room.floor}</span>
            ) : null}
          </span>
          {showStatus ? (
            <span className="self-start">
              <StatusBadge status={room.status} />
            </span>
          ) : null}
          <span className="truncate text-xs text-[#5b6475]">
            {shortLocation(room.property.name, room.property.ward)}
          </span>
          <span className="text-xs text-[#334155]">{meta.join(" · ")}</span>
          {popular.length > 0 ? (
            <span className="text-xs text-[#15803d]">✓ {popular.join(" · ")}</span>
          ) : null}
          <span className="mt-auto flex items-baseline justify-end gap-0.5">
            <span className="text-lg font-extrabold text-[#1d4fbf]">{formatVnd(room.priceMonthly)}</span>
            <span className="text-[11px] text-[#5b6475]">/tháng</span>
          </span>
        </span>
      </Link>
      {/* 8px card padding + 124px frame − 6px inset − 30px button */}
      <div className="absolute left-[96px] top-[14px]">
        <SaveRoomButton roomId={room.id} size="sm" />
      </div>
    </div>
  );
}
