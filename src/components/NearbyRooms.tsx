import Link from "next/link";
import { Building2, Navigation } from "lucide-react";
import RoomPhoto from "@/components/RoomPhoto";
import { formatVnd } from "@/lib/format";
import { NEARBY_RADIUS_KM } from "@/lib/geocode";
import { type NearbyRoom, formatDistance } from "@/lib/nearbyRooms";

export default function NearbyRooms({ rooms }: { rooms: NearbyRoom[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">Phòng gần đây</h2>
      <p className="mb-3 text-sm text-slate-500">
        Phòng còn trống cùng tòa nhà và trong bán kính {NEARBY_RADIUS_KM} km.
      </p>
      {rooms.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-black/5">
          Hiện chưa có phòng trống nào khác ở gần đây.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={`/rooms/${r.id}`}
              className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-lg"
            >
              <div className="relative">
                <RoomPhoto
                  src={r.image}
                  alt={`Ảnh phòng ${r.code}`}
                  className="h-40 w-full bg-slate-100 object-contain"
                />
                <span
                  className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm ${
                    r.sameBuilding ? "bg-emerald-600 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {r.sameBuilding ? (
                    <>
                      <Building2 className="h-3.5 w-3.5" aria-hidden /> Cùng tòa nhà
                    </>
                  ) : (
                    <>
                      <Navigation className="h-3.5 w-3.5" aria-hidden /> Cách {formatDistance(r.distanceKm)}
                    </>
                  )}
                </span>
              </div>
              <div className="p-4">
                <p className="truncate text-xs text-slate-500">{r.propertyName}</p>
                <h3 className="font-semibold text-slate-900 group-hover:text-[color:var(--color-accent-dark)]">
                  Phòng {r.code}
                  {r.floor ? <span className="font-normal text-slate-500"> · {r.floor}</span> : null}
                </h3>
                <p className="text-sm text-slate-500">{r.areaSqm} m²</p>
                <p className="mt-2 text-lg font-bold text-[color:var(--color-accent-dark)]">
                  {formatVnd(r.priceMonthly)}
                  <span className="text-xs font-normal text-slate-500">/tháng</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
