"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { formatVnd } from "@/lib/format";
import { BASE_PATH } from "@/lib/basePath";

export type MapProperty = {
  id: string;
  name: string;
  addressNew: string;
  lat: number;
  lng: number;
  rooms: { id: string; code: string; priceMonthly: number }[];
};

/**
 * Interactive map — round 10, §19. Free OpenStreetMap tiles via Leaflet, NOT
 * the paid Google Maps JS API (explicit owner decision, round 9 "1. 2. 3. OK
 * ... 8. dùng free"). One pin per property (Property.lat/lng, already
 * auto-geocoded on save — see geocodeForPropertySave in src/lib/db.ts);
 * clicking a pin pops up that property's currently-available rooms + prices.
 * Properties with no lat/lng (geocoding miss) are simply skipped — best
 * effort, same as the rest of the app treats missing coordinates.
 */
export default function PropertyMap({ properties }: { properties: MapProperty[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const L = (await import("leaflet")).default;

        // Leaflet's default marker icon references image files by a
        // relative URL that breaks under bundlers — this is the standard
        // workaround (point the icon URLs at the CDN copies instead).
        delete (
          L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown }
        )._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        if (cancelled || !containerRef.current) return;

        const withCoords = properties.filter(
          (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
        );

        const center: [number, number] =
          withCoords.length > 0
            ? [withCoords[0].lat, withCoords[0].lng]
            : [10.7769, 106.7009]; // fallback: central HCMC

        const map = L.map(containerRef.current).setView(center, 14);
        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        const markers: [number, number][] = [];
        for (const p of withCoords) {
          const marker = L.marker([p.lat, p.lng]).addTo(map);
          const roomsHtml =
            p.rooms.length > 0
              ? `<ul style="margin:4px 0 0;padding-left:16px;">${p.rooms
                  .map(
                    (r) =>
                      `<li><a href="${BASE_PATH}/rooms/${r.id}" style="color:#1d4fbf;font-weight:600;">${escapeHtml(
                        r.code
                      )}</a> — ${escapeHtml(formatVnd(r.priceMonthly))}/tháng</li>`
                  )
                  .join("")}</ul>`
              : `<p style="margin:4px 0 0;color:#94a3b8;">Hiện không có phòng trống.</p>`;
          marker.bindPopup(
            `<strong>${escapeHtml(p.name)}</strong><p style="margin:2px 0;color:#64748b;">${escapeHtml(
              p.addressNew
            )}</p>${roomsHtml}`
          );
          markers.push([p.lat, p.lng]);
        }

        if (markers.length > 1) {
          map.fitBounds(markers, { padding: [32, 32] });
        }
      } catch {
        if (!cancelled) setLoadError("Không tải được bản đồ. Vui lòng thử lại sau.");
      }
    }

    void init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // properties is derived server-side and stable per page load — intentionally
    // not re-running Leaflet init on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadError) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl bg-white text-sm text-slate-400 shadow-sm ring-1 ring-black/5">
        {loadError}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5"
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
