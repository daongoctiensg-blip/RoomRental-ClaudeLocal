import { listProperties, listRooms } from "@/lib/db";
import { isAdminSession } from "@/lib/apiAuth";
import RoomCard from "@/components/RoomCard";
import FilterBar from "@/components/FilterBar";
import MainSearchBar from "@/components/MainSearchBar";
import LogoutButton from "@/components/LogoutButton";
import type { RoomStatus } from "@/types";
import { ROOM_STATUSES } from "@/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const statusParam = firstValue(sp.status);
  const statuses: RoomStatus[] = statusParam
    ? (statusParam
        .split(",")
        .filter((s): s is RoomStatus => (ROOM_STATUSES as string[]).includes(s)))
    : ["available"]; // default filter per spec: only show available rooms unless the visitor opts in to others

  const address = firstValue(sp.address);
  const city = firstValue(sp.city);
  const ward = firstValue(sp.ward);
  const priceBucketKey = firstValue(sp.priceBucket);

  const { bucketByKey } = await import("@/lib/priceBuckets");
  const bucket = priceBucketKey ? bucketByKey(priceBucketKey) : undefined;

  const [rooms, admin, properties] = await Promise.all([
    listRooms({
      status: statuses,
      city,
      ward,
      address,
      priceMin: bucket?.min,
      priceMax: bucket?.max ?? undefined,
    }),
    isAdminSession(),
    listProperties(),
  ]);

  // Dropdown options come from real data (only city/ward combos that
  // actually have an active property) — never a hand-typed list that could
  // drift out of sync with what's actually listed. Filter out any property
  // that hasn't had city/ward filled in yet (blank strings) — otherwise an
  // unfilled property renders as a blank, unselectable option in both
  // dropdowns instead of just not contributing one.
  const locationOptions = Array.from(
    new Map(
      properties
        .filter((p) => p.city && p.ward)
        .map((p) => [`${p.city}\u0000${p.ward}`, { city: p.city, ward: p.ward }])
    ).values()
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
          <div className="text-xl font-bold tracking-tight text-[color:var(--color-accent-dark)]">
            Phòng Cho Thuê
          </div>
          {admin ? (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                Đang xem với quyền Admin
              </span>
              <a
                href="/admin"
                className="text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Vào trang quản trị
              </a>
              <LogoutButton redirectTo="/" className="text-xs font-medium text-slate-400 hover:text-slate-600" />
            </div>
          ) : (
            <a
              href="/admin"
              className="text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              Quản trị
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Tìm thấy {rooms.length} phòng
          </h1>
          <p className="text-sm text-slate-500">
            Xem danh sách phòng còn trống, lọc theo địa chỉ, trạng thái và giá thuê.
          </p>
        </div>

        <div className="mb-6">
          <MainSearchBar locationOptions={locationOptions} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <FilterBar />
          </aside>

          <div className="flex flex-col gap-4">
            {rooms.length === 0 ? (
              <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-black/5">
                Không tìm thấy phòng phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              rooms.map((room) => (
                <RoomCard key={room.id} room={room} admin={admin} />
              ))
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-black/5 bg-white py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Phòng Cho Thuê
      </footer>
    </div>
  );
}
