"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Heart, LocateFixed, Map as MapIcon, X } from "lucide-react";
import { useNearMe } from "@/lib/useNearMe";
import PropertyMap, { type MapProperty } from "@/components/PropertyMap";
import FullScreen from "@/components/mobile/FullScreen";
import { getSavedRoomIds, onSavedRoomsChange } from "@/lib/savedRooms";

/** Dark floating pill at the bottom of the mobile homepage — round 13:
 * "Bản đồ | Đã lưu (N)". The map opens full screen (same Leaflet map as
 * the desktop toggle); "Đã lưu" opens this browser's saved rooms. */
export default function MobileFloatingBar({
  properties,
  near,
  radiusKm,
}: {
  properties: MapProperty[];
  near?: { lat: number; lng: number };
  radiusKm: number;
}) {
  const { locate, clear, locating, error } = useNearMe();
  const [ids, setIds] = useState<string[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const closeMap = useCallback(() => setMapOpen(false), []);

  useEffect(() => {
    const sync = () => setIds(getSavedRoomIds());
    sync();
    return onSavedRoomsChange(sync);
  }, []);

  const item = "flex h-11 items-center gap-1.5 whitespace-nowrap px-4 text-sm font-semibold text-white!";

  return (
    <>
      <div className="fixed bottom-[max(1.75rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center rounded-full bg-[#16233b] shadow-[0_6px_18px_rgba(15,23,42,0.3)]">
        <button type="button" onClick={() => setMapOpen(true)} className={item}>
          <MapIcon className="h-4 w-4" aria-hidden />
          Bản đồ
        </button>
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

      {mapOpen ? (
        <FullScreen label="Bản đồ phòng" onClose={closeMap}>
          <div className="flex h-14 flex-none items-center justify-between border-b border-[#eef1f5] pl-4 pr-2">
            <h2 className="text-[17px] font-bold">Bản đồ</h2>
            <button
              type="button"
              onClick={closeMap}
              aria-label="Đóng bản đồ"
              className="flex h-11 w-11 items-center justify-center"
            >
              <X className="h-[22px] w-[22px]" aria-hidden />
            </button>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2 px-3 py-2">
            {near ? (
              <button
                type="button"
                onClick={clear}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-[#2f6fed] bg-[#eaf1ff] px-3 text-[13px] font-semibold text-[#1d4fbf]"
              >
                <LocateFixed className="h-4 w-4" aria-hidden />
                Trong {radiusKm} km quanh bạn
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => locate()}
                disabled={locating}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#dfe3ea] px-3 text-[13px] font-semibold text-[#1d4fbf] disabled:opacity-60"
              >
                <LocateFixed className="h-4 w-4" aria-hidden />
                {locating ? "Đang lấy vị trí…" : `Phòng gần tôi (${radiusKm} km)`}
              </button>
            )}
            <span className="text-xs text-[#5b6475]">
              {properties.length} tòa nhà · bấm ghim để xem phòng
            </span>
            {error ? <p className="w-full text-xs text-rose-600">{error}</p> : null}
          </div>
          <div className="min-h-0 flex-grow px-2 pb-2">
            <PropertyMap
              key={near ? `${near.lat},${near.lng}` : "all"}
              properties={properties}
              userLocation={near}
              radiusKm={radiusKm}
              className="h-full"
            />
          </div>
        </FullScreen>
      ) : null}
    </>
  );
}
