import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoom, getCurrentUtilityFee } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import RoomPhoto from "@/components/RoomPhoto";
import { formatVnd, telHref, zaloHref } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const room = await getRoom(id);
  if (!room) notFound();

  const property = room.property;
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
              <p className="mt-4 text-sm text-slate-600">
                Đặt cọc giữ chỗ: {formatVnd(property.depositPolicy.depositAmount)} —
                giữ {property.depositPolicy.holdDays} ngày.
              </p>
              <p className="text-xs text-slate-400">
                {property.depositPolicy.forfeitureRule}
              </p>
            </section>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            {property.promotion ? (
              <div className="rounded-xl bg-[color:var(--color-accent-light)] p-4 text-sm text-[color:var(--color-accent-dark)]">
                🎉 {property.promotion.description}
                <div className="mt-1 text-xs opacity-80">
                  Áp dụng {property.promotion.validFrom} –{" "}
                  {property.promotion.validTo}
                </div>
              </div>
            ) : null}

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
              </div>
              <p className="mt-3 text-center text-xs text-slate-400">
                Liên hệ để hẹn xem phòng trực tiếp
              </p>
            </div>
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
