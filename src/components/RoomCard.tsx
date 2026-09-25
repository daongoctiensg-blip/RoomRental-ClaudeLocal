import Link from "next/link";
import { Sparkles, Users, Eye, ArrowRight } from "lucide-react";
import type { RoomWithProperty } from "@/types";
import StatusBadge from "@/components/StatusBadge";
import RoomCardPhotoCarousel from "@/components/RoomCardPhotoCarousel";
import { AmenityIcon } from "@/components/AmenityIcon";
import { formatVnd, telHref, zaloHref } from "@/lib/format";
import { COMMON_AMENITY_KEYWORDS, amenityListMatches } from "@/lib/amenityKeywords";

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
}: {
  room: RoomWithProperty;
  admin?: boolean;
}) {
  const address = room.property.addressNew;
  const amenities = room.amenitiesOverride ?? room.property.amenitiesShared;
  // Quick tags — round 11: at-a-glance amenity badges so a customer doesn't
  // have to open every room to see if it has A/C, a washing machine, etc.
  // Matched against the same fixed keyword list the "Tiện ích phổ biến"
  // filter uses (src/lib/amenityKeywords.ts), capped so the card doesn't get
  // cluttered.
  const quickAmenityTags = COMMON_AMENITY_KEYWORDS.filter((k) =>
    amenityListMatches(amenities, k)
  ).slice(0, 3);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition-shadow duration-200 hover:shadow-lg sm:flex-row">
      <div className="relative sm:w-[280px] sm:flex-none">
        <RoomCardPhotoCarousel
          photos={room.images}
          roomCode={room.code}
          className="h-56 w-full object-cover sm:h-full sm:min-h-[260px]"
        />
        <div className="pointer-events-none absolute left-3 top-3">
          <StatusBadge status={room.status} />
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
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1 text-sky-700"
            >
              <AmenityIcon keyword={tag} className="h-3.5 w-3.5" />
              {tag}
            </span>
          ))}
          {room.viewCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-slate-500">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              {room.viewCount} lượt xem
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
          <div>
            <div className="text-3xl font-bold text-[color:var(--color-accent-dark)]">
              {formatVnd(room.priceMonthly)}
              <span className="text-sm font-normal text-slate-500">/tháng</span>
            </div>
            <Link
              href={`/rooms/${room.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-accent)] hover:underline"
            >
              Xem chi tiết
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div className="flex gap-2">
            <a
              href={telHref(room.property.contactPhone)}
              className="rounded-lg bg-[color:var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[color:var(--color-accent-dark)]"
            >
              Gọi ngay
            </a>
            <a
              href={zaloHref(room.property.contactPhone)}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Zalo
            </a>
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
