import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoom, getCurrentUtilityFee, toPublicRoom, recordRoomView } from "@/lib/db";
import { isAdminSession } from "@/lib/apiAuth";
import StatusBadge from "@/components/StatusBadge";
import RoomPhoto from "@/components/RoomPhoto";
import DepositCountdown from "@/components/DepositCountdown";
import ShareButtons from "@/components/ShareButtons";
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
  // below (see the "Nội bộ" section) so the two are never visually mixed up.
  const room: PublicRoom | RoomWithProperty = admin ? fullRoom : toPublicRoom(fullRoom);
  const property: Property | PublicProperty = room.property;
  const amenities = room.amenitiesOverride ?? property.amenitiesShared;
  const fee = getCurrentUtilityFee(property);
  const photos = room.images.length > 0 ? room.images : [undefined];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4">
          <Link
            href="/"
            className="text-sm font-medium text-[color:var(--color-accent)] hover:underline"
          >
            ← Danh sách phòng
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Phòng {room.code}
              {room.floor ? (
                <span className="ml-2 text-base font-normal text-slate-500">
                  · {room.floor}
                </span>
              ) : null}
            </h1>
            <p className="text-sm text-slate-500">{property.name}</p>
          </div>
          <StatusBadge status={room.status} />
        </div>

        {property.customerPromotion ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Khuyến mãi: </span>
            {property.customerPromotion}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <RoomPhoto
            src={photos[0]}
            alt={`Ảnh chính phòng ${room.code}`}
            className="col-span-full h-72 w-full rounded-xl object-cover sm:col-span-2 sm:row-span-2 sm:h-full"
          />
          {photos.slice(1, 5).map((src, i) => (
            <RoomPhoto
              key={i}
              src={src}
              alt={`Ảnh phòng ${room.code} ${i + 2}`}
              className="h-32 w-full rounded-xl object-cover sm:h-full"
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-5">
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="mb-3 text-base font-semibold text-slate-900">
                Thông tin phòng
              </h2>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Fact label="Diện tích" value={`${room.areaSqm} m²`} />
                <Fact label="Ban công" value={room.hasBalcony ? "Có" : "Không"} />
                <Fact
                  label="Giá thuê"
                  value={`${formatVnd(room.priceMonthly)}/tháng`}
                />
                {room.maxOccupancy ? (
                  <Fact label="Số người ở tối đa" value={`${room.maxOccupancy} người`} />
                ) : null}
                {room.viewCount > 0 ? (
                  <Fact label="Lượt xem" value={`${room.viewCount}`} />
                ) : null}
              </dl>
              {room.description ? (
                <p className="mt-4 text-sm text-slate-600">{room.description}</p>
              ) : null}
              {room.subUnits && room.subUnits.length > 0 ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">
                    Phòng gồm các khu riêng
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {room.subUnits.map((su, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>
                          {su.label}
                          {su.notes ? (
                            <span className="text-slate-400"> · {su.notes}</span>
                          ) : null}
                        </span>
                        {su.priceMonthly ? (
                          <span className="font-medium">
                            {formatVnd(su.priceMonthly)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="mb-3 text-base font-semibold text-slate-900">
                Tiện ích
              </h2>
              <ul className="grid list-disc grid-cols-1 gap-2 pl-5 text-sm text-slate-600 sm:grid-cols-2">
                {amenities.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="mb-3 text-base font-semibold text-slate-900">
                Vị trí &amp; di chuyển
              </h2>
              <p className="text-sm text-slate-600">{property.addressNew}</p>
              {property.addressOld ? (
                <p className="text-xs text-slate-400">
                  (Địa chỉ cũ: {property.addressOld})
                </p>
              ) : null}
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {property.transportNotes.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="mb-3 text-base font-semibold text-slate-900">
                Phí dịch vụ &amp; chính sách cọc
              </h2>
              {fee ? (
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <Fact
                    label="Điện"
                    value={`${formatVnd(fee.electricityPricePerKwh)}/kWh`}
                  />
                  <Fact
                    label="Nước"
                    value={`${formatVnd(fee.waterPricePerPerson)}/người`}
                  />
                  <Fact
                    label="Phí dịch vụ"
                    value={`${formatVnd(fee.serviceFeePerMonth)}/tháng`}
                  />
                </dl>
              ) : null}
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <Fact
                  label="Cọc giữ phòng"
                  value={`${formatVnd(property.depositPolicy.holdAmount)} (giữ ${property.depositPolicy.holdDays} ngày)`}
                />
                <Fact
                  label="Cọc khi ký hợp đồng"
                  value={`${property.depositPolicy.securityDepositMonths} tháng tiền thuê`}
                />
                <Fact
                  label="Thanh toán trước khi ký"
                  value={`${property.depositPolicy.prepaidRentMonths} tháng tiền thuê`}
                />
              </dl>
              {property.depositPolicy.customerNote ? (
                <p className="mt-3 text-xs text-slate-400">
                  {property.depositPolicy.customerNote}
                </p>
              ) : null}
            </section>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="text-3xl font-bold text-[color:var(--color-accent-dark)]">
                {formatVnd(room.priceMonthly)}
                <span className="text-sm font-normal text-slate-500">
                  /tháng
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Chưa gồm điện, nước, phí dịch vụ.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <a
                  href={telHref(property.contactPhone)}
                  className="w-full rounded-lg bg-[color:var(--color-accent)] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[color:var(--color-accent-dark)]"
                >
                  Gọi {property.contactPhone}
                </a>
                <a
                  href={zaloHref(property.contactPhone)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Nhắn Zalo
                </a>
                <Link
                  href={`/rooms/${room.id}/export`}
                  target="_blank"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Xuất PDF
                </Link>
              </div>
              <ShareButtons
                title={`Phòng ${room.code} · ${property.name}`}
                phone={property.contactPhone}
              />
              <p className="mt-3 text-center text-xs text-slate-400">
                Liên hệ để hẹn xem phòng trực tiếp
              </p>
            </div>

            {admin ? (
              <section className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-amber-900">
                  Nội bộ (Sale)
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                    Khách không thấy mục này
                  </span>
                </h2>

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
          </aside>
        </div>
      </main>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
