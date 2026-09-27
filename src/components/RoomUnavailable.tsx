import Link from "next/link";
import { DoorClosed } from "lucide-react";
import NearbyRooms from "@/components/NearbyRooms";
import type { NearbyRoom } from "@/lib/nearbyRooms";

/** Round 15: what a guest sees when opening a room that is no longer
 * available. Deliberately says nothing about WHY (đã cọc / đã cho thuê /
 * đang sửa chữa) — only admins may see room statuses. */
export default function RoomUnavailable({
  nearby,
  propertyName,
}: {
  nearby: NearbyRoom[];
  propertyName: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <Link href="/" className="text-sm font-medium text-[color:var(--color-accent)] hover:underline">
            ← Danh sách phòng
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-black/5">
          <DoorClosed className="h-10 w-10 text-slate-400" aria-hidden />
          <h1 className="text-xl font-bold text-slate-900">Phòng này hiện không còn trống</h1>
          <p className="max-w-md text-sm text-slate-500">
            Phòng tại {propertyName} đã có người thuê hoặc đang tạm ngưng cho thuê. Anh/chị xem các
            phòng còn trống khác bên dưới nhé.
          </p>
          <Link
            href="/"
            className="mt-2 rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-accent-dark)]"
          >
            Xem tất cả phòng trống
          </Link>
        </div>
        <NearbyRooms rooms={nearby} />
      </main>
    </div>
  );
}
