import Link from "next/link";
import { listProperties, listRooms } from "@/lib/db";
import RoomActions from "@/components/RoomActions";
import StatusBadge from "@/components/StatusBadge";
import { formatVnd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [properties, rooms] = await Promise.all([
    listProperties({ includeInactive: true }),
    // includeInactiveProperties: an unlisted (deactivated) property's rooms
    // must still show up here — deactivating just hides it from the public
    // site, it doesn't delete anything.
    listRooms(undefined, { includeInactiveProperties: true }),
  ]);

  const roomsByProperty = new Map<string, typeof rooms>();
  for (const room of rooms) {
    const list = roomsByProperty.get(room.propertyId) ?? [];
    list.push(room);
    roomsByProperty.set(room.propertyId, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <Link
          href="/admin/commissions"
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          Xem hoa hồng &amp; lì xì
        </Link>
      </div>

      {properties.map((property) => (
        <section
          key={property.id}
          className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {property.name}
                {!property.isActive ? (
                  <span className="ml-2 text-xs font-normal text-red-500">
                    (đã ẩn)
                  </span>
                ) : null}
              </h2>
              <p className="text-sm text-slate-500">{property.addressNew}</p>
            </div>
            <Link
              href={`/admin/properties/${property.id}`}
              className="text-sm font-medium text-[color:var(--color-accent)] hover:underline"
            >
              Sửa thông tin nhà
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2">Mã phòng</th>
                  <th className="py-2">Tầng</th>
                  <th className="py-2">Diện tích</th>
                  <th className="py-2">Giá/tháng</th>
                  <th className="py-2">Trạng thái</th>
                  <th className="py-2">Thao tác</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(roomsByProperty.get(property.id) ?? []).map((room) => (
                  <tr key={room.id}>
                    <td className="py-2 font-medium text-slate-800 align-top">
                      {room.code}
                    </td>
                    <td className="py-2 text-slate-600 align-top">{room.floor ?? "—"}</td>
                    <td className="py-2 text-slate-600 align-top">{room.areaSqm} m²</td>
                    <td className="py-2 text-slate-600 align-top">
                      {formatVnd(room.priceMonthly)}
                    </td>
                    <td className="py-2 align-top">
                      <StatusBadge status={room.status} />
                    </td>
                    <td className="py-2 align-top">
                      <RoomActions
                        roomId={room.id}
                        status={room.status}
                        currentDeposit={room.currentDeposit}
                        commissionPolicy={property.commissionPolicy}
                      />
                    </td>
                    <td className="py-2 text-right align-top">
                      <Link
                        href={`/admin/rooms/${room.id}`}
                        className="text-sm font-medium text-[color:var(--color-accent)] hover:underline"
                      >
                        Sửa
                      </Link>
                    </td>
                  </tr>
                ))}
                {(roomsByProperty.get(property.id) ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-400">
                      Chưa có phòng nào.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {properties.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-black/5">
          Chưa có nhà nào.{" "}
          <Link href="/admin/properties/new" className="text-[color:var(--color-accent)] hover:underline">
            Thêm nhà mới
          </Link>
        </div>
      ) : null}
    </div>
  );
}
