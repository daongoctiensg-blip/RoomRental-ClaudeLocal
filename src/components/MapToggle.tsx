"use client";

import { useState } from "react";
import PropertyMap, { type MapProperty } from "@/components/PropertyMap";

/** Collapsed by default — loading the Leaflet map on every page view would
 * be wasted work for the common case (customer just wants the list). */
export default function MapToggle({ properties }: { properties: MapProperty[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {open ? "Ẩn bản đồ ▲" : "🗺️ Xem trên bản đồ"}
      </button>
      {open ? <PropertyMap properties={properties} /> : null}
    </div>
  );
}
