"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, LocateFixed, X } from "lucide-react";
import { useNearMe } from "@/lib/useNearMe";
import { getSavedRoomIds, onSavedRoomsChange } from "@/lib/savedRooms";

/** Dark floating pill at the bottom of the mobile homepage: "Gần tôi |
 * Đã lưu (N)". Round 15: the map was removed at the owner's request, so the
 * left half is now "Phòng gần tôi (2 km)" (filters the list by the
 * browser's location); while it's on, it becomes "Bỏ gần tôi". */
export default function MobileFloatingBar({
  near,
  radiusKm,
}: {
  near?: { lat: number; lng: number };
  radiusKm: number;
}) {
  const { locate, clear, locating, error } = useNearMe();
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(getSavedRoomIds());
    sync();
    return onSavedRoomsChange(sync);
  }, []);

  const item = "flex h-11 items-center gap-1.5 whitespace-nowrap px-4 text-sm font-semibold text-white!";

  return (
    <div className="fixed bottom-[max(1.75rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
      {error ? (
        <p className="max-w-[88vw] rounded-lg bg-rose-50 px-3 py-2 text-center text-xs text-rose-700 shadow ring-1 ring-rose-200">
          {error}
        </p>
      ) : null}
      <div className="flex items-center rounded-full bg-[#16233b] shadow-[0_6px_18px_rgba(15,23,42,0.3)]">
        {near ? (
          <button type="button" onClick={clear} className={item} aria-label="Bỏ lọc theo vị trí">
            <X className="h-4 w-4" aria-hidden />
            Bỏ gần tôi
          </button>
        ) : (
          <button type="button" onClick={() => locate()} disabled={locating} className={`${item} disabled:opacity-60`}>
            <LocateFixed className="h-4 w-4" aria-hidden />
            {locating ? "Đang lấy vị trí…" : `Gần tôi (${radiusKm} km)`}
          </button>
        )}
        <span className="h-5 w-px bg-white/30" />
        {ids.length > 0 ? (
          <Link href={`/?saved=${encodeURIComponent(ids.join(","))}`} className={item}>
            <Heart className="h-4 w-4 fill-[#fb7185] text-[#fb7185]" aria-hidden />
            Đã lưu ({ids.length})
          </Link>
        ) : (
          <span className={`${item} text-white/60!`} title="Bấm ♡ trên một phòng để lưu">
            <Heart className="h-4 w-4" aria-hidden />
            Đã lưu
          </span>
        )}
      </div>
    </div>
  );
}
