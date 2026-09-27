import Link from "next/link";
import { listProperties, listRooms } from "@/lib/db";
import RoomActions from "@/components/RoomActions";
import StatusBadge from "@/components/StatusBadge";
import StatusQuickSwitch from "@/components/StatusQuickSwitch";
import DuplicateRoomButton from "@/components/DuplicateRoomButton";
import { formatVnd } from "@/lib/format";
import type { RoomStatus } from "@/types";
import { MoreHorizontal, Pencil } from "lucide-react";
import AdminRoomSearch from "@/components/mobile/AdminRoomSearch";

export const dynamic = "force-dynamic";

// Round 14: the KPI cards are links that filter the room list below.
// "occupied" = the "Tỉ lệ lấp đầy" card (đã cọc + đã cho thuê).
const KPI_FILTERS: Record<string, { label: string; statuses: RoomStatus[] }> = {
  available: { label: "Còn trống", statuses: ["available"] },
  deposited: { label: "Đã cọc", statuses: ["deposited"] },
  sold: { label: "Đã cho thuê", statuses: ["sold"] },
  renovating: { label: "Đang sửa chữa", statuses: ["renovating"] },
  occupied: { label: "Đang lấp đầy (đã cọc + đã cho thuê)", statuses: ["deposited", "sold"] },
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const viewKey = typeof sp.view === "string" && sp.view in KPI_FILTERS ? sp.view : null;
  const view = viewKey ? KPI_FILTERS[viewKey] : null;
  const [properties, rooms] = await Promise.all([
    listProperties({ includeInactive: true }),
    // includeInactiveProperties: an unlisted (deactivated) property's rooms
    // must still show up here — deactivating just hides it from the public
    // site, it doesn't delete anything.
    listRooms(undefined, { includeInactiveProperties: true }),
  ]);

  // With a KPI filter on, only active rooms in those statuses are listed
  // (the same rooms the card counted).
  const shownRooms = view
    ? rooms.filter((r) => r.isActive && view.statuses.includes(r.status))
    : rooms;
  const shownProperties = view
    ? properties.filter((p) => shownRooms.some((r) => r.propertyId === p.id))
    : properties;
  const roomsByProperty = new Map<string, typeof rooms>();
  for (const room of shownRooms) {
    const list = roomsByProperty.get(room.propertyId) ?? [];
    list.push(room);
    roomsByProperty.set(room.propertyId, list);
  }

  // Admin KPI dashboard — round 10, §15. Read-only, derived entirely from
  // the rooms already fetched above (includeInactiveProperties: true, so
  // this also reflects rooms on a currently-unlisted property) — no new
  // schema, no new query.
  const activeRooms = rooms.filter((r) => r.isActive);
  const totalRooms = activeRooms.length;
  const availableCount = activeRooms.filter((r) => r.status === "available").length;
  const depositedCount = activeRooms.filter((r) => r.status === "deposited").length;
  const soldCount = activeRooms.filter((r) => r.status === "sold").length;
  const renovatingCount = activeRooms.filter((r) => r.status === "renovating").length;
  // "Occupied" = actually generating revenue right now (đã cọc + đã cho
  // thuê); a room under sửa chữa is neither occupied nor available to book,
  // so it's excluded from both the numerator and (implicitly, since it's
  // still counted in totalRooms) the denominator's "free" side.
  const occupancyRate =
    totalRooms > 0 ? Math.round(((depositedCount + soldCount) / totalRooms) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 md:gap-8">
      {/* Mobile KPI strip — round 13, scrolls sideways. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
        {[
          { k: "Tổng phòng", v: String(totalRooms), c: "text-[#16233b]!", view: null },
          { k: "Còn trống", v: String(availableCount), c: "text-[#15803d]!", view: "available" },
          { k: "Đã cọc", v: String(depositedCount), c: "text-[#b45309]!", view: "deposited" },
          { k: "Đã cho thuê", v: String(soldCount), c: "text-[#475569]!", view: "sold" },
          { k: "Sửa chữa", v: String(renovatingCount), c: "text-[#b91c1c]!", view: "renovating" },
          { k: "Lấp đầy", v: `${occupancyRate}%`, c: "text-[#1d4fbf]!", view: "occupied" },
        ].map((x) => {
          const on = x.view === viewKey;
          return (
            <Link
              key={x.k}
              href={x.view ? `/admin?view=${x.view}` : "/admin"}
              aria-current={on ? "page" : undefined}
              className={`flex min-w-[92px] flex-none flex-col gap-0.5 rounded-xl border bg-white px-3 py-2.5 ${
                on ? "border-[#2f6fed] ring-2 ring-[#2f6fed]/30" : "border-[#e8ebf1]"
              }`}
            >
              <span className="text-[11px] text-[#5b6475]">{x.k}</span>
              <span className={`text-[22px] font-extrabold ${x.c}`}>{x.v}</span>
            </Link>
          );
        })}
      </div>

      <div className="hidden grid-cols-2 gap-3 sm:grid-cols-3 md:grid lg:grid-cols-6">
        <KpiCard label="Tổng số phòng" value={String(totalRooms)} view={null} active={!view} />
        <KpiCard label="Còn trống" value={String(availableCount)} accent="text-[color:var(--color-available)]" view="available" active={viewKey === "available"} />
        <KpiCard label="Đã cọc" value={String(depositedCount)} accent="text-[color:var(--color-deposited)]" view="deposited" active={viewKey === "deposited"} />
        <KpiCard label="Đã cho thuê" value={String(soldCount)} accent="text-[color:var(--color-sold)]" view="sold" active={viewKey === "sold"} />
        <KpiCard label="Đang sửa chữa" value={String(renovatingCount)} accent="text-[color:var(--color-renovating)]" view="renovating" active={viewKey === "renovating"} />
        <KpiCard label="Tỉ lệ lấp đầy" value={`${occupancyRate}%`} accent="text-[color:var(--color-accent-dark)]" view="occupied" active={viewKey === "occupied"} />
      </div>

      <div className="hidden justify-end md:flex">
        <Link
          href="/admin/commissions"
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          Xem hoa hồng &amp; lì xì
        </Link>
      </div>

      {view ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#c7d7fb] bg-[#eaf1ff] px-4 py-2.5 text-sm text-[#1d4fbf]">
          <span>
            Đang lọc: <strong>{view.label}</strong> · {shownRooms.length} phòng
          </span>
          <Link href="/admin" className="font-semibold text-[#1d4fbf] hover:underline">
            Bỏ lọc ✕
          </Link>
        </div>
      ) : null}

      <AdminRoomSearch>
      {shownProperties.map((property) => (
        <section
          key={property.id}
          data-room-group
          className="md:rounded-xl md:bg-white md:p-5 md:shadow-sm md:ring-1 md:ring-black/5"
        >
          <div className="mb-2 flex items-start justify-between gap-3 md:mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 md:text-lg md:font-semibold">
                {property.name}
                {!property.isActive ? (
                  <span className="ml-2 text-xs font-normal text-red-500">
                    (đã ẩn)
                  </span>
                ) : null}
              </h2>
              <p className="hidden text-sm text-slate-500 md:block">{property.addressNew}</p>
              {property.lat == null || property.lng == null ? (
                <Link
                  href={`/admin/properties/${property.id}`}
                  className="mt-1 inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800! ring-1 ring-amber-200"
                >
                  ⚠ Chưa có tọa độ — không hiện trên bản đồ / “Phòng gần tôi”. Bấm để thêm.
                </Link>
              ) : null}
            </div>
            <Link
              href={`/admin/properties/${property.id}`}
              className="flex-none text-[13px] font-semibold text-[color:var(--color-accent)] hover:underline md:text-sm md:font-medium"
            >
              <span className="md:hidden">Sửa nhà</span>
              <span className="hidden md:inline">Sửa thông tin nhà</span>
            </Link>
          </div>

          {/* Mobile room cards — round 13 (Claude Design board "6"). */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {(roomsByProperty.get(property.id) ?? []).map((room) => (
              <article
                key={room.id}
                data-room-code={room.code}
                className="flex flex-col gap-2.5 rounded-[14px] border border-[#e8ebf1] bg-white py-3 pl-3.5 pr-3"
              >
                <div className="flex justify-between gap-2.5">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[17px] font-extrabold">
                      {room.code}
                      {room.internalNotes ? (
                        <span title={room.internalNotes} className="ml-1 text-sm text-amber-500">
                          📝
                        </span>
                      ) : null}
                      {!room.isActive ? (
                        <span className="ml-1.5 text-xs font-normal text-red-500">(đã ẩn)</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-[#5b6475]">
                      {[
                        room.floor,
                        `${room.areaSqm} m²`,
                        room.hasBalcony ? "Ban công" : null,
                        room.subUnits && room.subUnits.length > 0 ? `${room.subUnits.length} phòng ngủ` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-[15px] font-extrabold text-[#1d4fbf]">
                    {formatVnd(room.priceMonthly)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={room.status} />
                  <StatusQuickSwitch roomId={room.id} status={room.status} size="lg" />
                  <span className="flex-grow" />
                  <Link
                    href={`/admin/rooms/${room.id}`}
                    aria-label={`Sửa phòng ${room.code}`}
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-[#dfe3ea]"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Link>
                  <details className="relative">
                    <summary
                      aria-label={`Thao tác khác cho ${room.code}`}
                      className="flex h-[38px] w-[38px] cursor-pointer list-none items-center justify-center rounded-[10px] border border-[#dfe3ea] bg-white [&::-webkit-details-marker]:hidden"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </summary>
                    <div className="absolute right-0 top-11 z-20 flex w-44 flex-col gap-1 rounded-xl bg-white p-2 text-sm shadow-lg ring-1 ring-black/10">
                      <Link href={`/rooms/${room.id}`} className="rounded px-2 py-1.5 hover:bg-slate-50">
                        Xem trang khách
                      </Link>
                      <Link href={`/admin/rooms/${room.id}/history`} className="rounded px-2 py-1.5 hover:bg-slate-50">
                        Lịch sử
                      </Link>
                      <div className="px-2 py-1.5">
                        <DuplicateRoomButton room={room} />
                      </div>
                    </div>
                  </details>
                </div>
                <RoomActions
                  roomId={room.id}
                  status={room.status}
                  currentDeposit={room.currentDeposit}
                  commissionPolicy={property.commissionPolicy}
                />
              </article>
            ))}
            {(roomsByProperty.get(property.id) ?? []).length === 0 ? (
              <p className="rounded-[14px] bg-white p-4 text-center text-sm text-slate-400">Chưa có phòng nào.</p>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
                      {room.internalNotes ? (
                        <span
                          title={room.internalNotes}
                          className="ml-1 cursor-help text-amber-500"
                        >
                          📝
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 text-slate-600 align-top">{room.floor ?? "—"}</td>
                    <td className="py-2 text-slate-600 align-top">{room.areaSqm} m²</td>
                    <td className="py-2 text-slate-600 align-top">
                      {formatVnd(room.priceMonthly)}
                    </td>
                    <td className="py-2 align-top">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={room.status} />
                        <StatusQuickSwitch roomId={room.id} status={room.status} />
                      </div>
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
                      <div className="flex flex-col items-end gap-1">
                        <Link
                          href={`/admin/rooms/${room.id}`}
                          className="text-sm font-medium text-[color:var(--color-accent)] hover:underline"
                        >
                          Sửa
                        </Link>
                        <DuplicateRoomButton room={room} />
                      </div>
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
      </AdminRoomSearch>

      {view && shownProperties.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-black/5">
          Không có phòng nào ở trạng thái “{view.label}”.
        </div>
      ) : null}

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

function KpiCard({
  label,
  value,
  accent,
  view,
  active,
}: {
  label: string;
  value: string;
  accent?: string;
  /** Round 14: which ?view= this card filters to (null = show all). */
  view: string | null;
  active: boolean;
}) {
  return (
    <Link
      href={view ? `/admin?view=${view}` : "/admin"}
      aria-current={active ? "page" : undefined}
      title={view ? `Lọc danh sách: ${label}` : "Hiện tất cả phòng"}
      className={`rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md ${
        active ? "ring-2 ring-[color:var(--color-accent)]" : "ring-1 ring-black/5"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-slate-900"}`}>{value}</p>
    </Link>
  );
}
