"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { getSavedRoomIds, onSavedRoomsChange } from "@/lib/savedRooms";

/** Header link to the visitor's saved rooms — round 12. Hidden until at
 * least one room is saved, so first-time visitors don't see an empty
 * feature. */
export default function SavedRoomsLink() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(getSavedRoomIds());
    sync();
    return onSavedRoomsChange(sync);
  }, []);

  if (ids.length === 0) return null;
  return (
    <Link
      href={`/?saved=${encodeURIComponent(ids.join(","))}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100"
    >
      <Heart className="h-3.5 w-3.5 fill-current" aria-hidden />
      Đã lưu ({ids.length})
    </Link>
  );
}
