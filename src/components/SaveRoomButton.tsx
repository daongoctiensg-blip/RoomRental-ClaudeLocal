"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { isRoomSaved, onSavedRoomsChange, toggleSavedRoom } from "@/lib/savedRooms";

/** Heart toggle — round 12. `variant="overlay"` is the round white button
 * sitting on a room card's photo (trip.com style); `variant="inline"` is the
 * "♡ Lưu" text button next to the title on the room detail page. */
export default function SaveRoomButton({
  roomId,
  variant = "overlay",
}: {
  roomId: string;
  variant?: "overlay" | "inline";
}) {
  // Starts false on the server and on first client render (no storage
  // access during SSR), then syncs — avoids a hydration mismatch.
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(isRoomSaved(roomId));
    sync();
    return onSavedRoomsChange(sync);
  }, [roomId]);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSaved(toggleSavedRoom(roomId));
  };
  const label = saved ? "Bỏ lưu phòng này" : "Lưu phòng này";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={label}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          saved
            ? "border-rose-200 bg-rose-50 text-rose-600"
            : "border-slate-300 text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} aria-hidden />
        {saved ? "Đã lưu" : "Lưu"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/5 transition hover:scale-105"
    >
      <Heart
        className={`h-5 w-5 ${saved ? "fill-rose-500 text-rose-500" : "text-slate-700"}`}
        aria-hidden
      />
    </button>
  );
}
