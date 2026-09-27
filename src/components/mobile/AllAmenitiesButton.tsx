"use client";

import { useCallback, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import AmenityGrid from "@/components/AmenityGrid";
import FullScreen from "@/components/mobile/FullScreen";
import type { AmenityGroupDisplay } from "@/lib/amenities";

/** "Xem tất cả N tiện nghi ›" on the mobile detail page — opens the full
 * grouped list full screen. */
export default function AllAmenitiesButton({ groups }: { groups: AmenityGroupDisplay[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1 self-start rounded-[10px] border border-[#dfe3ea] px-3.5 text-sm font-semibold text-[#1d4fbf]"
      >
        Xem tất cả {count} tiện nghi
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <FullScreen label="Tất cả tiện nghi" onClose={close}>
          <div className="flex h-14 flex-none items-center justify-between border-b border-[#eef1f5] pl-4 pr-2">
            <h2 className="text-[17px] font-bold">Tiện nghi &amp; Dịch vụ ({count})</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Đóng"
              className="flex h-11 w-11 items-center justify-center"
            >
              <X className="h-[22px] w-[22px]" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <AmenityGrid groups={groups} />
          </div>
        </FullScreen>
      ) : null}
    </>
  );
}
