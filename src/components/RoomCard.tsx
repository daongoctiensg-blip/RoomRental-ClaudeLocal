import Link from "next/link";
import type { RoomWithProperty } from "@/types";
import StatusBadge from "@/components/StatusBadge";
import RoomPhoto from "@/components/RoomPhoto";
import { formatVnd, telHref, zaloHref } from "@/lib/format";

export default function RoomCard({ room }: { room: RoomWithProperty }) {
  const address = room.property.addressNew;

  return (
    <article className="flex flex-col sm:flex-row overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="relative sm:w-64 sm:flex-none">
        <RoomPhoto
          src={room.images[0]}
          alt={`Ảnh phòng ${room.code}`}
          className="h-48 w-full object-cover sm:h-full"
        />
        <div className="absolute left-3 top-3">
          <StatusBadge status={room.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Phòng {room.code}
              {room.floor ? (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  · {room.floor}
                </span>
              ) : null}
            </h3>
            <p className="text-sm text-slate-500">{address}</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-[color:var(--color-accent-dark)]">
              {formatVnd(room.priceMonthly)}
              <span className="text-sm font-normal text-slate-500">/tháng</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            {room.areaSqm} m²
          </span>
          {room.hasBalcony ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1">Ban công</span>
          ) : null}
          {room.subUnits && room.subUnits.length > 0 ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              {room.subUnits.length} phòng ngủ riêng
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link
            href={`/rooms/${room.id}`}
            className="text-sm font-medium text-[color:var(--color-accent)] hover:underline"
          >
            Xem chi tiết →
          </Link>
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
      </div>
    </article>
  );
}
