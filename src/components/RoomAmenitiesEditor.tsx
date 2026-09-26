"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Eye } from "lucide-react";
import { apiUrl } from "@/lib/basePath";
import {
  type Amenity,
  buildAmenityLookup,
  effectiveAmenities,
  normalizeAmenityName,
} from "@/lib/amenities";
import { AmenityIcon } from "@/components/AmenityIcon";
import AmenityPicker from "@/components/AmenityPicker";

/**
 * Room amenities — round 12e. Owner's feedback: the old "Tiện ích riêng (để
 * trống = dùng tiện ích chung của nhà)" box didn't show what the building
 * actually has, and it silently REPLACED the building list (one extra item
 * meant retyping all of the building's). Now a room inherits the building's
 * amenities and only stores the difference:
 *   - every building amenity is shown, ticked; untick the ones this room
 *     doesn't have (→ `removed`);
 *   - room-only extras are added with the usual type-and-Enter picker
 *     (→ `added`);
 *   - "Khách sẽ thấy" previews the final list exactly as effectiveAmenities()
 *     will compute it on the public pages.
 * Each building chip is its own <label> around ONE checkbox (never several
 * buttons in one label — see FieldGroup in PropertyForm for why).
 */
export default function RoomAmenitiesEditor({
  buildingName,
  buildingAmenities,
  added,
  removed,
  onChange,
}: {
  buildingName?: string;
  buildingAmenities: string[];
  added: string[];
  removed: string[];
  onChange: (next: { added: string[]; removed: string[] }) => void;
}) {
  const [catalog, setCatalog] = useState<Amenity[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/amenities"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { amenities: Amenity[] } | null) => {
        if (!cancelled && data) setCatalog(data.amenities);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const lookup = useMemo(() => buildAmenityLookup(catalog), [catalog]);

  const buildingKeys = useMemo(
    () => new Set(buildingAmenities.map(normalizeAmenityName)),
    [buildingAmenities]
  );
  const removedKeys = new Set(removed.map(normalizeAmenityName));
  const finalList = effectiveAmenities(
    { amenitiesAdded: added, amenitiesRemoved: removed },
    buildingAmenities
  );

  const toggleBuilding = (name: string) => {
    const key = normalizeAmenityName(name);
    onChange({
      added,
      removed: removedKeys.has(key)
        ? removed.filter((n) => normalizeAmenityName(n) !== key)
        : [...removed, name],
    });
  };

  // Picking a building amenity in the "thêm riêng" picker just re-ticks it —
  // it's inherited, so it must not be stored as an addition too.
  const setAdded = (next: string[]) => {
    const reTicked = next.filter((n) => buildingKeys.has(normalizeAmenityName(n)));
    const reTickedKeys = new Set(reTicked.map(normalizeAmenityName));
    onChange({
      added: next.filter((n) => !buildingKeys.has(normalizeAmenityName(n))),
      removed: removed.filter((n) => !reTickedKeys.has(normalizeAmenityName(n))),
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div>
        <p className="text-sm font-medium text-slate-700">
          Có sẵn từ tòa nhà{buildingName ? ` "${buildingName}"` : ""}
        </p>
        <p className="mb-2 text-xs text-slate-500">
          Phòng tự có các tiện ích này. Bỏ tích món nào phòng này <strong>không có</strong>.
        </p>
        {buildingAmenities.length === 0 ? (
          <p className="text-sm text-slate-500">
            Tòa nhà chưa khai báo tiện ích chung (sửa ở trang của tòa nhà).
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {buildingAmenities.map((name) => {
              const has = !removedKeys.has(normalizeAmenityName(name));
              return (
                <label
                  key={name}
                  className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ring-1 transition ${
                    has
                      ? "bg-white text-slate-800 ring-slate-300"
                      : "bg-slate-100 text-slate-400 line-through ring-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={has}
                    onChange={() => toggleBuilding(name)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <AmenityIcon
                    icon={lookup.get(normalizeAmenityName(name))?.icon}
                    className="h-3.5 w-3.5"
                  />
                  {name}
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700">Thêm riêng cho phòng này</p>
        <p className="mb-2 text-xs text-slate-500">
          Ví dụ phòng này có ban công riêng, bồn tắm… mà các phòng khác không có.
        </p>
        <AmenityPicker
          value={added}
          onChange={setAdded}
          hideNames={buildingAmenities.filter((n) => !removedKeys.has(normalizeAmenityName(n)))}
          placeholder="Gõ để tìm, hoặc gõ tên mới rồi Enter…"
        />
      </div>

      <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Khách sẽ thấy ({finalList.length})
        </p>
        {finalList.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có tiện ích nào.</p>
        ) : (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
            {finalList.map((n) => (
              <li key={n} className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                {n}
                {!buildingKeys.has(normalizeAmenityName(n)) ? (
                  <span className="rounded bg-sky-100 px-1 text-[10px] font-medium text-sky-700">
                    riêng
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
