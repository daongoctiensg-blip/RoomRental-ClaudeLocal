import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoom, getCurrentUtilityFee, toPublicRoom } from "@/lib/db";
import { isAdminSession } from "@/lib/apiAuth";
import RoomPhoto from "@/components/RoomPhoto";
import PrintButton from "@/components/PrintButton";
import { formatVnd, telHref, zaloHref } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Print/PDF-export view of a room's public listing — confirmed scope
 * (from the owner's video + screenshot): a "Xuất PDF" button on the room
 * detail page opens this page, and the customer uses the browser's own
 * "Save as PDF" print destination. No PDF-generation library, no server
 * rendering to a binary — this route just lays the same data out in a
 * print-friendly way and calls window.print() (see <PrintButton>).
 *
 * IMPORTANT: this ALWAYS uses the public-safe shape (toPublicRoom), even
 * when an admin is the one opening it. The whole point of "cọc trong pdf
 * là cọc công khai" is that a PDF handed to a customer can never leak the
 * internal landlord/sale split — that must hold regardless of who
 * generated the PDF, so this page doesn't take the same "admin sees more"
 * branch the regular room detail page does.
 */
export default async function RoomExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [fullRoom, admin] = await Promise.all([getRoom(id), isAdminSession()]);
  if (!fullRoom) notFound();
  // Same visibility rule as the regular detail page: a deactivated room (or
  // one on a deactivated property) is unreachable by a non-admin, even via
  // this export route.
  if (!admin && (!fullRoom.isActive || !fullRoom.property.isActive)) notFound();

  const room = toPublicRoom(fullRoom);
  const property = room.property;
  const amenities = room.amenitiesOverride ?? property.amenitiesShared;
  const fee = getCurrentUtilityFee(property);
  const photos = room.images.length > 0 ? room.images : [undefined];

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-white px-6 py-8 print:px-0 print:py-0">
      <div className="no-print mb-6 flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <Link
          href={`/rooms/${room.id}`}
          className="text-sm font-medium text-[color:var(--color-accent)] hover:underline"
        >
          ← Quay lại chi tiết phòng
        </Link>
        <PrintButton className="rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-accent-dark)]" />
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Phòng {room.code}
          {room.floor ? (
            <span className="ml-2 text-base font-normal text-slate-500">· {room.floor}</span>
          ) : null}
        </h1>
        <p className="text-sm text-slate-600">{property.name}</p>
        <p className="text-sm text-slate-600">{property.addressNew}</p>
        {property.addressOld ? (
          <p className="text-xs text-slate-400">(Địa chỉ cũ: {property.addressOld})</p>
        ) : null}
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2 print:grid-cols-3">
        <RoomPhoto
          src={photos[0]}
          alt={`Ảnh chính phòng ${room.code}`}
          className="col-span-2 h-64 w-full rounded-lg object-cover print:col-span-3 print:h-56"
        />
        {photos.slice(1, 5).map((src, i) => (
          <RoomPhoto
            key={i}
            src={src}
            alt={`Ảnh phòng ${room.code} ${i + 2}`}
            className="h-28 w-full rounded-lg object-cover"
          />
        ))}
      </div>

      <section className="mb-6 break-inside-avoid">
        <div className="rounded-lg bg-slate-50 p-4 print:bg-transparent print:p-0">
          <div className="text-2xl font-bold text-[color:var(--color-accent-dark)]">
            {formatVnd(room.priceMonthly)}
            <span className="text-sm font-normal text-slate-500">/tháng</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Chưa gồm điện, nước, phí dịch vụ.</p>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <Fact label="Diện tích" value={`${room.areaSqm} m²`} />
          <Fact label="Ban công" value={room.hasBalcony ? "Có" : "Không"} />
          <Fact label="Loại phòng" value={room.subUnits && room.subUnits.length > 0 ? "Nhiều khu riêng" : "Nguyên phòng"} />
        </dl>
      </section>

      {amenities.length > 0 ? (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-base font-semibold text-slate-900">Tiện ích</h2>
          <ul className="grid list-disc grid-cols-2 gap-1 pl-5 text-sm text-slate-700">
            {amenities.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {property.transportNotes.length > 0 ? (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-base font-semibold text-slate-900">Di chuyển</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {property.transportNotes.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 text-base font-semibold text-slate-900">Phí dịch vụ &amp; chính sách cọc</h2>
        {fee ? (
          <dl className="mb-3 grid grid-cols-3 gap-3 text-sm">
            <Fact label="Điện" value={`${formatVnd(fee.electricityPricePerKwh)}/kWh`} />
            <Fact label="Nước" value={`${formatVnd(fee.waterPricePerPerson)}/người`} />
            <Fact label="Phí dịch vụ" value={`${formatVnd(fee.serviceFeePerMonth)}/tháng`} />
          </dl>
        ) : null}
        <dl className="grid grid-cols-3 gap-3 text-sm">
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
          <p className="mt-3 text-xs text-slate-500">{property.depositPolicy.customerNote}</p>
        ) : null}
      </section>

      <section className="break-inside-avoid rounded-lg border border-slate-200 p-4 print:border-black/20">
        <h2 className="mb-2 text-base font-semibold text-slate-900">Liên hệ</h2>
        <p className="text-sm text-slate-700">
          Số điện thoại:{" "}
          <a href={telHref(property.contactPhone)} className="font-semibold text-[color:var(--color-accent-dark)] underline">
            {property.contactPhone}
          </a>
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Zalo:{" "}
          <a
            href={zaloHref(property.contactPhone)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[color:var(--color-accent-dark)] underline"
          >
            zalo.me/{property.contactPhone.replace(/\D/g, "")}
          </a>
        </p>
      </section>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 14mm; }
        }
      `}</style>
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
