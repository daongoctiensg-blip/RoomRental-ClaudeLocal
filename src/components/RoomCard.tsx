import Link from "next/link";
import { Sparkles, Users, Eye, ArrowRight } from "lucide-react";
import type { RoomWithProperty } from "@/types";
import StatusBadge from "@/components/StatusBadge";
import RoomCardPhotoCarousel from "@/components/RoomCardPhotoCarousel";
import { AmenityIcon } from "@/components/AmenityIcon";
import SaveRoomButton from "@/components/SaveRoomButton";
import { formatVnd, telHref, zaloHref } from "@/lib/format";
import { type Amenity, effectiveAmenities, normalizeAmenityName } from "@/lib/amenities";

// "Mới đăng" quick tag — round 11. A room created within this many days of
// today gets a small "new listing" badge on its card, matching what most
// rental sites do to draw attention to fresh inventory.
const NEW_LISTING_DAYS = 7;
function isNewListing(createdAt: string): boolean {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs >= 0 && ageMs <= NEW_LISTING_DAYS * 24 * 60 * 60 * 1000;
}

function isBonusActiveToday(validFrom: string, validTo: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return today >= validFrom && today <= validTo;
}

/** admin=true reveals a compact "nội bộ" (Sale-only) strip — commission per
 * contract-duration tier and the "lì xì" bonus if currently valid. Nothing
 * here is rendered at all when admin is false, so a customer's page never
 * receives this in the HTML — see isAdminSession() in src/lib/apiAuth.ts for
 * how the caller decides admin vs customer. */
export default function RoomCard({
  room,
  admin = false,
  catalog,
}: {
  room: RoomWithProperty;
  admin?: boolean;
  /** Amenity catalog (round 12) — source of each tag's icon and of which
   * amenities count as "phổ biến". */
  catalog: Amenity[];
}) {
  const address = room.property.addressNew;
  const amenities = effectiveAmenities(room, room.property.amenitiesShared);
  // Quick tags — at-a-glance amenity badges so a customer doesn't have to
  // open every room to see if it has A/C, a washing machine, etc. Round 12:
  // driven by the amenity catalog — only items the admin marked "phổ
  // biến", in catalog order, with the catalog's icon. Capped at 3 so the
  // card doesn't get cluttered.
  const roomKeys = new Set(amenities.map(normalizeAmenityName));
  const quickAmenityTags = catalog
    .filter((a) => a.isPopular && roomKeys.has(normalizeAmenityName(a.name)))
    .slice(0, 3);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition-shadow duration-200 hover:shadow-lg sm:flex-row">
      <div className="relative sm:w-[280px] sm:flex-none">
        <RoomCardPhotoCarousel
          photos={room.images}
          roomCode={room.code}
          className="h-64 w-full bg-slate-100 object-contain"
        />
        <div className="pointer-events-none absolute left-3 top-3">
          <StatusBadge status={room.status} />
        </div>
        <div className="absolute right-3 top-3">
          <SaveRoomButton roomId={room.id} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <div>
          <p className="text-sm text-slate-500">{address}</p>
          {room.floor ? (
            <p className="text-sm text-slate-500">{room.floor}</p>
          ) : null}
          <h3 className="mt-1 text-2xl font-bold leading-tight text-slate-900">
            Phòng {room.code}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          {isNewListing(room.createdAt) ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Mới đăng
            </span>
          ) : null}
          <span className="rounded-md bg-slate-100 px-2.5 py-1">
            {room.areaSqm} m²
          </span>
          {room.maxOccupancy ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {room.maxOccupancy} người
            </span>
          ) : null}
          {room.hasBalcony ? (
            <span className="rounded-md bg-slate-100 px-2.5 py-1">Ban công</span>
          ) : null}
          {room.subUnits && room.subUnits.length > 0 ? (
            <span className="rounded-md bg-slate-100 px-2.5 py-1">
              {room.subUnits.length} phòng ngủ riêng
            </span>
          ) : null}
          {quickAmenityTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1 text-sky-700"
            >
              <AmenityIcon icon={tag.icon} className="h-3.5 w-3.5" />
              {tag.name}
            </span>
          ))}
          {room.viewCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-slate-500">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              {room.viewCount} lượt xem
            </span>
          ) : null}
        </div>

        {/* Price + CTAs — round 11 trip.com-style refresh: "Xem chi tiết" is
            now the prominent primary button (matching trip.com's big blue
            "Xem Phòng Trống"), leading straight to the room's own detail
            page; Gọi ngay/Zalo stay as a smaller secondary row underneath
            for the customer who wants to skip straight to contacting,
            rather than being replaced. */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="text-3xl font-bold text-[color:var(--color-accent-dark)]">
            {formatVnd(room.priceMonthly)}
            <span className="text-sm font-normal text-slate-500">/tháng</span>
          </div>
          <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
            <Link
              href={`/rooms/${room.id}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--color-accent-dark)]"
            >
              Xem chi tiết
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <div className="flex gap-2">
              <a
                href={telHref(room.property.contactPhone)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Gọi ngay
              </a>
              <a
                href={zaloHref(room.property.contactPhone)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Zalo
              </a>
            </div>
          </div>
        </div>

        {admin ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
            <span className="font-semibold uppercase tracking-wide text-amber-600">
              Nội bộ:
            </span>
            {room.property.commissionPolicy.map((tier) => (
              <span key={tier.contractDurationMonths}>
                {tier.contractDurationMonths}th {tier.commissionPercent}% (
                {formatVnd(Math.round((room.priceMonthly * tier.commissionPercent) / 100))}
                )
              </span>
            ))}
            {room.property.saleBonusPolicy &&
            isBonusActiveToday(
              room.property.saleBonusPolicy.validFrom,
              room.property.saleBonusPolicy.validTo
            ) ? (
              <span className="font-medium">
                🧧 Lì xì {formatVnd(room.property.saleBonusPolicy.amount)}
              </span>
            ) : null}
            <Link
              href={`/admin/rooms/${room.id}`}
              className="ml-auto font-medium text-amber-700 hover:underline"
            >
              Quản lý →
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}
