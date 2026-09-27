"use client";

import { LocateFixed, X } from "lucide-react";
import { useNearMe } from "@/lib/useNearMe";

/** "Phòng gần tôi (2 km)" on the desktop homepage — round 15. Replaces the
 * map toggle (the owner asked to hide the map): it only filters the list to
 * rooms within `radiusKm` of the visitor's browser location. */
export default function NearMeButton({
  active,
  radiusKm,
}: {
  active: boolean;
  radiusKm: number;
}) {
  const { locate, clear, locating, error } = useNearMe();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {active ? (
        <span className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--color-accent)] bg-[color:var(--color-accent-light)] px-3 py-1.5 text-sm font-medium text-[color:var(--color-accent-dark)]">
          <LocateFixed className="h-4 w-4" aria-hidden />
          Đang xem phòng trong {radiusKm} km quanh vị trí của bạn
          <button
            type="button"
            onClick={clear}
            aria-label="Bỏ lọc theo vị trí"
            className="rounded p-0.5 hover:bg-white/70"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => locate()}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-[color:var(--color-accent-dark)] hover:bg-slate-50 disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" aria-hidden />
          {locating ? "Đang lấy vị trí…" : `Phòng gần tôi (${radiusKm} km)`}
        </button>
      )}
      {error ? <span className="text-sm text-rose-600">{error}</span> : null}
    </div>
  );
}
