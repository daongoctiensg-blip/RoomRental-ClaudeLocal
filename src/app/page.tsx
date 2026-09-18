import { listRooms } from "@/lib/db";
import RoomCard from "@/components/RoomCard";
import FilterBar from "@/components/FilterBar";
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
  const priceBucketKey = firstValue(sp.priceBucket);

  const { bucketByKey } = await import("@/lib/priceBuckets");
  const bucket = priceBucketKey ? bucketByKey(priceBucketKey) : undefined;

  const rooms = await listRooms({
    status: statuses,
    address,
    priceMin: bucket?.min,
    priceMax: bucket?.max ?? undefined,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="text-xl font-bold tracking-tight text-[color:var(--color-accent-dark)]">
            Phòng Cho Thuê
          </div>
          <a
            href="/admin"
            className="text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Quản trị
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Tìm thấy {rooms.length} phòng
          </h1>
          <p className="text-sm text-slate-500">
            Xem danh sách phòng còn trống, lọc theo địa chỉ, trạng thái và giá thuê.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <FilterBar />
          </aside>

          <div className="flex flex-col gap-4">
            {rooms.length === 0 ? (
              <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-black/5">
                Không tìm thấy phòng phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              rooms.map((room) => <RoomCard key={room.id} room={room} />)
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
