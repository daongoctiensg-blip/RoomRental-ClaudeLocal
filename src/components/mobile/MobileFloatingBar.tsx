"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Map as MapIcon, X } from "lucide-react";
import PropertyMap, { type MapProperty } from "@/components/PropertyMap";
import FullScreen from "@/components/mobile/FullScreen";
import { getSavedRoomIds, onSavedRoomsChange } from "@/lib/savedRooms";

/** Dark floating pill at the bottom of the mobile homepage — round 13:
 * "Bản đồ | Đã lưu (N)". The map opens full screen (same Leaflet map as
 * the desktop toggle); "Đã lưu" opens this browser's saved rooms. */
export default function MobileFloatingBar({ properties }: { properties: MapProperty[] }) {
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
          <div className="flex-grow p-2 [&>div]:h-full">
            <PropertyMap properties={properties} />
          </div>
        </FullScreen>
      ) : null}
    </>
  );
}
