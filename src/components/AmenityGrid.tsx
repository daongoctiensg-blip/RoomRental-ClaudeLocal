import { Check } from "lucide-react";
import { AmenityIcon } from "@/components/AmenityIcon";
import type { AmenityGroupDisplay } from "@/lib/amenities";

/**
 * Full amenity list for the room detail page, grouped by the amenity
 * catalog's groups (Nội thất / Thiết bị / Phòng tắm & vệ sinh / …) with each
 * item's catalog icon — round 12. Used both inline in the "Tiện nghi & Dịch
 * vụ" tab and inside the slide-over drawer opened from "Tổng quan". Replaces
 * round 11's "keyword highlights + raw free-text lines" version: now that
 * every amenity is its own catalog item, there's no free text left that
 * would need showing separately.
 */
export default function AmenityGrid({ groups }: { groups: AmenityGroupDisplay[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-slate-500">Chưa cập nhật tiện ích cho phòng này.</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">{g.label}</h3>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm text-slate-700 sm:grid-cols-2">
            {g.items.map((a) => (
              <li key={a.name} className="flex items-center gap-2">
                <AmenityIcon icon={a.icon} className="h-4 w-4 flex-none text-slate-500" />
                <span className="flex-1">{a.name}</span>
                <Check className="h-3.5 w-3.5 flex-none text-emerald-500" aria-hidden />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
