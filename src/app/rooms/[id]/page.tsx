import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone, MessageCircle, FileDown, Maximize2, DoorOpen, Users, Layers } from "lucide-react";
import {
  getRoom,
  getCurrentUtilityFee,
  listRooms,
  toPublicRoom,
  recordRoomView,
} from "@/lib/db";
import { isAdminSession } from "@/lib/apiAuth";
import { listAmenities } from "@/lib/amenityCatalog";
import { groupAmenities, resolveAmenities } from "@/lib/amenities";
import { calculateMoveInCost } from "@/lib/moveInCost";
import { findNearbyRooms } from "@/lib/nearbyRooms";
import StatusBadge from "@/components/StatusBadge";
import DepositCountdown from "@/components/DepositCountdown";
import ShareButtons from "@/components/ShareButtons";
import PhotoGallery from "@/components/PhotoGallery";
import RoomDetailTabs, { RoomTabLink } from "@/components/RoomDetailTabs";
import SaveRoomButton from "@/components/SaveRoomButton";
import NearbyRooms from "@/components/NearbyRooms";
import { AmenityIcon } from "@/components/AmenityIcon";
import Fact from "@/components/Fact";
import { formatVnd, telHref, zaloHref } from "@/lib/format";
import type { Property, PublicProperty, PublicRoom, RoomWithProperty } from "@/types";

export const dynamic = "force-dynamic";

function isBonusActiveToday(validFrom: string, validTo: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return today >= validFrom && today <= validTo;
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [fullRoom, admin] = await Promise.all([getRoom(id), isAdminSession()]);
  if (!fullRoom) notFound();
  // A deactivated room, or a room on a deactivated (unlisted) property, is
  // hidden from the public listing/search — it must be equally unreachable
  // by guessing/bookmarking its direct URL. An admin still needs to open it
  // (e.g. to review before reactivating), so this only applies to
  // non-admins. Found in QA: this page had no active-status check at all.
  if (!admin && (!fullRoom.isActive || !fullRoom.property.isActive)) notFound();
  // Real view counter — every open of this page counts, for every viewer
  // type (customer, sale, admin alike). Deliberately NOT called from
  // getRoom() itself, since that's also used by non-detail-page contexts
  // (admin edit form load, API lookups, contract flows) where a view should
  // not be counted. Not awaited: counting a view is not something the
  // visitor should ever wait on or see fail the page over.
  void recordRoomView(id);
  // Customer gets the sanitized shape (no commission, no landlord contact,
  // no "lì xì", no cancellation split) — same as always. A logged-in admin
  // gets the full internal data instead, shown in a clearly separated panel
  // (see the "Nội bộ" section) so the two are never visually mixed up.
  const room: PublicRoom | RoomWithProperty = admin ? fullRoom : toPublicRoom(fullRoom);
  const property: Property | PublicProperty = room.property;
  const fee = getCurrentUtilityFee(property);

  // Round 12 data: amenity catalog (icons/groups), nearby rooms, move-in
  // cost. listRooms() with no admin option only returns rooms on active
  // properties; findNearbyRooms() then keeps only "available" ones and maps
  // them to a public-only summary shape before anything reaches the page.
  const [catalog, availableRooms] = await Promise.all([
    listAmenities(),
    listRooms({ status: ["available"] }),
  ]);
  const amenities = resolveAmenities(room.amenitiesOverride ?? property.amenitiesShared, catalog);
  const amenityGroups = groupAmenities(amenities);
  // Highlights: "phổ biến" items first (same ones as the homepage filter),
  // then the rest, in the order the admin picked them.
  const highlights = [
    ...amenities.filter((a) => a.isPopular),
    ...amenities.filter((a) => !a.isPopular),
  ];
  const moveIn = calculateMoveInCost(room.priceMonthly, property.depositPolicy);
  const nearby = findNearbyRooms(fullRoom, availableRooms);

  const summary = [
    { icon: Maximize2, text: `${room.areaSqm} m²` },
    room.floor ? { icon: Layers, text: room.floor } : null,
    room.hasBalcony ? { icon: DoorOpen, text: "Ban công" } : null,
    room.maxOccupancy ? { icon: Users, text: `Tối đa ${room.maxOccupancy} người` } : null,
  ].filter((x): x is { icon: typeof Maximize2; text: string } => x !== null);

  // Icon strip under the photos (trip.com's "Vị trí lý tưởng · Tự nhận
  // phòng · Wi-Fi miễn phí…" row): real facts only.
  const strip = [
    ...(room.hasBalcony ? [{ icon: "sun", name: "Ban công riêng" }] : []),
    ...highlights.slice(0, room.hasBalcony ? 5 : 6).map((a) => ({ icon: a.icon, name: a.name })),
  ];

  const photoSidePanel = (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Phòng {room.code}</h3>
        <p className="text-slate-500">{property.name}</p>
      </div>
      <ul className="flex flex-col gap-1.5 text-slate-700">
        {summary.map((s) => (
          <li key={s.text} className="flex items-center gap-2">
            <s.icon className="h-4 w-4 text-slate-400" aria-hidden />
            {s.text}
          </li>
        ))}
      </ul>
      {amenities.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Tiện nghi</p>
          <ul className="grid grid-cols-2 gap-1.5 text-slate-700">
            {highlights.slice(0, 10).map((a) => (
              <li key={a.name} className="flex items-center gap-1.5">
                <AmenityIcon icon={a.icon} className="h-3.5 w-3.5 flex-none text-slate-400" />
                <span className="truncate">{a.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-auto border-t border-slate-100 pt-4">
        <div className="text-2xl font-bold text-[color:var(--color-accent-dark)]">
          {formatVnd(room.priceMonthly)}
          <span className="text-xs font-normal text-slate-500">/tháng</span>
        </div>
        <a
          href={telHref(property.contactPhone)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--color-accent)] px-4 py-2.5 font-semibold text-white hover:bg-[color:var(--color-accent-dark)]"
        >
          <Phone className="h-4 w-4" aria-hidden /> Gọi {property.contactPhone}
        </a>
      </div>
    </div>
  );

  const sidebar = (
    <>
      <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5">
        <div className="bg-[color:var(--color-accent-light)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-accent-dark)]">
          Giá thuê hàng tháng
        </div>
        <div className="p-5">
          <div className="text-3xl font-bold text-[color:var(--color-accent-dark)]">
            {formatVnd(room.priceMonthly)}
            <span className="text-sm font-normal text-slate-500">/tháng</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Chưa gồm điện, nước, phí dịch vụ.</p>

          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">Phòng {room.code}</p>
            <ul className="mt-1.5 flex flex-col gap-1 text-sm text-slate-600">
              {summary.map((s) => (
                <li key={s.text} className="flex items-center gap-2">
                  <s.icon className="h-4 w-4 text-slate-400" aria-hidden />
                  {s.text}
                </li>
              ))}
            </ul>
          </div>

          {moveIn.totalAtSigning > 0 ? (
            <div className="mt-3 flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-600">
                Khi ký HĐ cần:{" "}
                <strong className="text-slate-900">{formatVnd(moveIn.totalAtSigning)}</strong>
              </span>
              <RoomTabLink
                tab="policy"
                className="flex-none text-xs font-medium text-[color:var(--color-accent)] hover:underline"
              >
                Xem chi tiết
              </RoomTabLink>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2">
            <a
              href={telHref(property.contactPhone)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--color-accent)] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--color-accent-dark)]"
            >
              <Phone className="h-4 w-4" aria-hidden />
              Gọi {property.contactPhone}
            </a>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={zaloHref(property.contactPhone)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Nhắn Zalo
              </a>
              <Link
                href={`/rooms/${room.id}/export`}
                target="_blank"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <FileDown className="h-4 w-4" aria-hidden />
                Xuất PDF
              </Link>
            </div>
          </div>
          <ShareButtons
            title={`Phòng ${room.code} · ${property.name}`}
            phone={property.contactPhone}
          />
          <p className="mt-3 text-center text-xs text-slate-400">
            Liên hệ để hẹn xem phòng trực tiếp
          </p>
        </div>
      </div>

            {admin ? (
              <section className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-amber-900">
                  Nội bộ (Sale)
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                    Khách không thấy mục này
                  </span>
                </h2>

                {fullRoom.internalNotes ? (
                  <div className="mb-4 rounded-lg bg-white p-3 ring-1 ring-amber-200">
                    <dt className="text-xs uppercase tracking-wide text-amber-700">
                      Ghi chú nội bộ
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-amber-900">
                      {fullRoom.internalNotes}
                    </dd>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <Fact label="Chủ nhà" value={fullRoom.property.landlordName || "—"} />
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs uppercase tracking-wide text-amber-700">
                      Liên hệ chủ nhà
                    </dt>
                    <dd className="flex flex-wrap gap-2">
                      {fullRoom.property.landlordContactPhone ? (
                        <a
                          href={telHref(fullRoom.property.landlordContactPhone)}
                          className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
                        >
                          Gọi {fullRoom.property.landlordContactPhone}
                        </a>
                      ) : null}
                      {fullRoom.property.landlordZalo ? (
                        <a
                          href={zaloHref(fullRoom.property.landlordZalo)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-amber-400 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                        >
                          Zalo chủ nhà
                        </a>
                      ) : null}
                      {!fullRoom.property.landlordContactPhone && !fullRoom.property.landlordZalo
                        ? "—"
                        : null}
                    </dd>
                  </div>
                </div>

                <div className="mt-4 border-t border-amber-200 pt-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Hoa hồng theo thời hạn hợp đồng
                  </h3>
                  <ul className="flex flex-wrap gap-2 text-sm text-amber-900">
                    {fullRoom.property.commissionPolicy.map((tier) => (
                      <li
                        key={tier.contractDurationMonths}
                        className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-amber-200"
                      >
                        {tier.contractDurationMonths} tháng: {tier.commissionPercent}% (
                        {formatVnd(
                          Math.round((fullRoom.priceMonthly * tier.commissionPercent) / 100)
                        )}
                        )
                      </li>
                    ))}
                  </ul>
                </div>

                {fullRoom.property.saleBonusPolicy ? (
                  <div className="mt-4 border-t border-amber-200 pt-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Lì xì cho sale
                    </h3>
                    <p className="text-sm text-amber-900">
                      🧧 {fullRoom.property.saleBonusPolicy.description} —{" "}
                      <strong>{formatVnd(fullRoom.property.saleBonusPolicy.amount)}</strong>
                      {" · "}
                      {isBonusActiveToday(
                        fullRoom.property.saleBonusPolicy.validFrom,
                        fullRoom.property.saleBonusPolicy.validTo
                      ) ? (
                        <span className="font-medium text-emerald-700">Đang trong hạn</span>
                      ) : (
                        <span className="text-amber-500">Hết hạn/chưa tới hạn</span>
                      )}{" "}
                      ({fullRoom.property.saleBonusPolicy.validFrom} →{" "}
                      {fullRoom.property.saleBonusPolicy.validTo})
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 border-t border-amber-200 pt-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Chính sách huỷ cọc (khách chủ động huỷ trước hạn)
                  </h3>
                  <p className="text-sm text-amber-900">
                    Chủ nhà {fullRoom.property.depositCancellationPolicy.landlordSharePercent}% —
                    Sale {fullRoom.property.depositCancellationPolicy.saleSharePercent}% (áp dụng
                    trên phần còn lại sau khi trừ tiền giữ chỗ theo số ngày đã giữ).
                  </p>
                  {fullRoom.property.depositCancellationPolicy.note ? (
                    <p className="mt-1 text-xs text-amber-700">
                      {fullRoom.property.depositCancellationPolicy.note}
                    </p>
                  ) : null}
                </div>

                {fullRoom.status === "deposited" && fullRoom.currentDeposit ? (
                  <div className="mt-4 border-t border-amber-200 pt-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Đang giữ cọc
                    </h3>
                    <p className="text-sm text-amber-900">
                      {formatVnd(fullRoom.currentDeposit.holdAmount)} · giữ{" "}
                      {fullRoom.currentDeposit.holdDays} ngày ·{" "}
                      <DepositCountdown
                        deadlineIso={new Date(
                          new Date(fullRoom.currentDeposit.depositedAt).getTime() +
                            fullRoom.currentDeposit.holdDays * 24 * 60 * 60 * 1000
                        ).toISOString()}
                      />
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex gap-4 border-t border-amber-200 pt-4 text-sm">
                  <Link
                    href={`/admin/rooms/${fullRoom.id}`}
                    className="font-medium text-amber-700 hover:underline"
                  >
                    Sửa / quản lý phòng →
                  </Link>
                  <Link
                    href={`/admin/rooms/${fullRoom.id}/history`}
                    className="font-medium text-amber-700 hover:underline"
                  >
                    Xem lịch sử →
                  </Link>
                </div>
              </section>
            ) : null}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <Link
            href="/"
            className="text-sm font-medium text-[color:var(--color-accent)] hover:underline"
          >
            ← Danh sách phòng
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                Phòng {room.code}
                {room.floor ? (
                  <span className="ml-2 text-base font-normal text-slate-500">· {room.floor}</span>
                ) : null}
              </h1>
              <StatusBadge status={room.status} />
            </div>
            <p className="text-sm font-medium text-slate-600">{property.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-slate-500">
              <MapPin className="h-4 w-4 flex-none text-slate-400" aria-hidden />
              {property.addressNew}
              <RoomTabLink
                tab="location"
                className="ml-1 font-medium text-[color:var(--color-accent)] hover:underline"
              >
                Xem vị trí
              </RoomTabLink>
            </p>
          </div>
          <SaveRoomButton roomId={room.id} variant="inline" />
        </div>

        {property.customerPromotion ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Khuyến mãi: </span>
            {property.customerPromotion}
          </div>
        ) : null}

        <PhotoGallery photos={room.images} roomCode={room.code} sidePanel={photoSidePanel} />

        {strip.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:grid-cols-3 lg:grid-cols-6">
            {strip.map((s) => (
              <li key={s.name} className="flex flex-col items-center gap-1.5 text-center text-xs text-slate-600">
                <AmenityIcon icon={s.icon} className="h-6 w-6 text-slate-500" />
                {s.name}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4">
          <RoomDetailTabs
            room={room}
            property={property}
            fee={fee}
            amenityGroups={amenityGroups}
            highlights={highlights}
            moveIn={moveIn}
            sidebar={sidebar}
          />
        </div>

        <NearbyRooms rooms={nearby} />
      </main>
    </div>
  );
}
