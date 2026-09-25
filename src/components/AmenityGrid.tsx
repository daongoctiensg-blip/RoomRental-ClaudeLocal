import { Check } from "lucide-react";
import { COMMON_AMENITY_KEYWORDS, amenityListMatches } from "@/lib/amenityKeywords";
import { AmenityIcon } from "@/components/AmenityIcon";

/**
 * Icon-based amenity summary for the room detail page — round 11 UI
 * refresh, replacing the plain gạch-đầu-dòng text list with an icon grid
 * (matching the "Tiện nghi" look of trip.com-style listing sites). Reuses
 * the exact same keyword list the "Tiện ích phổ biến" sidebar filter
 * matches against (src/lib/amenityKeywords.ts), so the two never show
 * different vocabulary for the same underlying data — the whole point of
 * this component is to fix that mismatch (see round 11 owner feedback).
 *
 * The landlord's original free-text amenity lines are still shown in full
 * underneath ("Tất cả tiện ích") — nothing is dropped, since a single line
 * like "Đầy đủ nội thất: tủ lạnh, máy lạnh, máy giặt, giường, bếp, tủ quần
 * áo, bàn ghế" carries several keyword matches plus items with no fixed
 * keyword (giường, bàn ghế) all in one sentence, so it can't be safely
 * split apart per amenity.
 */
export default function AmenityGrid({ amenities }: { amenities: string[] }) {
  const matched = COMMON_AMENITY_KEYWORDS.filter((k) => amenityListMatches(amenities, k));

  return (
    <div>
      {matched.length > 0 ? (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Nổi bật
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {matched.map((keyword) => (
              <div
                key={keyword}
                className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                <AmenityIcon keyword={keyword} className="h-4 w-4 flex-none" />
                <span className="truncate">{keyword}</span>
                <Check className="ml-auto h-3.5 w-3.5 flex-none text-emerald-500" aria-hidden />
              </div>
            ))}
          </div>
        </>
      ) : null}

      <p
        className={`mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 ${
          matched.length > 0 ? "mt-4 border-t border-slate-100 pt-4" : ""
        }`}
      >
        Tất cả tiện ích
      </p>
      <ul className="grid list-disc grid-cols-1 gap-2 pl-5 text-sm text-slate-600 sm:grid-cols-2">
        {amenities.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  );
}
