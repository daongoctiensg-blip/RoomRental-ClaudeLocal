"use client";

import { useState } from "react";
import { LocateFixed, X } from "lucide-react";
import PropertyMap, { type MapProperty } from "@/components/PropertyMap";
import { useNearMe } from "@/lib/useNearMe";

/** Collapsed by default — loading the Leaflet map on every page view would
 * be wasted work for the common case (customer just wants the list).
 *
 * Round 14: "Phòng gần tôi (2 km)" asks for the visitor's location and
 * switches the whole page (list + map) to rooms within the radius; the map
 * then opens on its own, centered on the visitor with the 2 km circle. */
export default function MapToggle({
  properties,
  near,
  radiusKm,
}: {
  properties: MapProperty[];
  near?: { lat: number; lng: number };
  radiusKm: number;
}) {
  const [open, setOpen] = useState(false);
  const { locate, clear, locating, error } = useNearMe();
  const shown = open || Boolean(near);

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {near ? null : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {open ? "Ẩn bản đồ ▲" : "🗺️ Xem trên bản đồ"}
          </button>
        )}
        {near ? (
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
      {shown ? (
        <PropertyMap
          // Re-create the map when the location changes.
          key={near ? `${near.lat},${near.lng}` : "all"}
          properties={properties}
          userLocation={near}
          radiusKm={radiusKm}
        />
      ) : null}
    </div>
  );
}
