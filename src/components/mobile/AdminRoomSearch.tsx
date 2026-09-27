"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

/** "Tìm mã phòng…" on the mobile admin dashboard — round 13. Filters the
 * server-rendered room cards in place (by their data-room-code) and hides
 * buildings with no match; nothing is refetched. */
export default function AdminRoomSearch({ children }: { children: React.ReactNode }) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const needle = q.trim().toLowerCase();
    root.querySelectorAll<HTMLElement>("[data-room-group]").forEach((group) => {
      let visible = 0;
      group.querySelectorAll<HTMLElement>("[data-room-code]").forEach((card) => {
        const match = !needle || (card.dataset.roomCode ?? "").toLowerCase().includes(needle);
        card.hidden = !match;
        if (match) visible++;
      });
      group.hidden = Boolean(needle) && visible === 0;
    });
  }, [q]);

  return (
    <div ref={ref} className="flex flex-col gap-4 md:gap-8">
      <label className="flex h-11 items-center gap-2 rounded-[10px] border border-[#dfe3ea] bg-white px-3 md:hidden">
        <Search className="h-4 w-4 text-[#5b6475]" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm mã phòng…"
          aria-label="Tìm mã phòng"
          className="flex-grow bg-transparent text-sm outline-none"
        />
      </label>
      {children}
    </div>
  );
}
