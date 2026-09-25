"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { ROOM_STATUSES, ROOM_STATUS_LABEL, type RoomStatus } from "@/types";
import { PRICE_BUCKETS } from "@/lib/priceBuckets";
import PriceRangeSlider from "@/components/PriceRangeSlider";
import { AmenityIcon } from "@/components/AmenityIcon";

/**
 * Secondary refinement filters (status, price bucket). The primary search
 * controls (free-text address, city/ward) live in <MainSearchBar> at the top
 * of the page instead — this bar sits alongside the results as a narrower
 * "refine further" panel.
 */
export default function FilterBar({
  popularAmenities,
}: {
  /** Round 12: the checkbox list is the amenity catalog's "phổ biến"
   * items (admin-controlled), no longer a hardcoded keyword list. */
  popularAmenities: { name: string; icon: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedStatuses = new Set(
    (searchParams.get("status") ?? "available").split(",").filter(Boolean)
  );

  // priceMin/priceMax are the single source of truth for the price range —
  // both the fixed bucket pills and the dual-range slider below read and
  // write these same two params, so dragging the slider moves the active
  // pill highlight and clicking a pill moves the slider handles. `priceMax`
  // absent means "no upper bound" (the slider's right handle sits at its
  // max, showing "X+"). A legacy `priceBucket=<key>` param (from links
  // shared before the slider existed) is still honored for display here —
  // see page.tsx, which falls back to it server-side too.
  const legacyBucket = searchParams.get("priceBucket")
    ? PRICE_BUCKETS.find((b) => b.key === searchParams.get("priceBucket"))
    : undefined;
  const selectedMin = searchParams.has("priceMin")
    ? Number(searchParams.get("priceMin"))
    : (legacyBucket?.min ?? 0);
  const selectedMax = searchParams.has("priceMax")
    ? Number(searchParams.get("priceMax"))
    : (legacyBucket?.max ?? null);

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  const toggleStatus = (status: RoomStatus) => {
    pushParams((params) => {
      const current = new Set(
        (params.get("status") ?? "available").split(",").filter(Boolean)
      );
      if (current.has(status)) {
        current.delete(status);
      } else {
        current.add(status);
      }
      if (current.size === 0) {
        params.delete("status");
      } else {
        params.set("status", Array.from(current).join(","));
      }
    });
  };

  const applyRange = useCallback(
    (nextMin: number, nextMax: number | null) => {
      pushParams((params) => {
        if (nextMin > 0) {
          params.set("priceMin", String(nextMin));
        } else {
          params.delete("priceMin");
        }
        if (nextMax !== null) {
          params.set("priceMax", String(nextMax));
        } else {
          params.delete("priceMax");
        }
        // Superseded by priceMin/priceMax now that the slider exists — drop
        // it so a stale bucket key never overrides the values just set.
        params.delete("priceBucket");
      });
    },
    [pushParams]
  );

  const toggleBucket = (bucketMin: number, bucketMax: number | null) => {
    const isActive = selectedMin === bucketMin && selectedMax === bucketMax;
    if (isActive) {
      applyRange(0, null);
    } else {
      applyRange(bucketMin, bucketMax);
    }
  };

  const selectedOccupancy = searchParams.get("occupancy");

  const toggleOccupancy = (value: "1" | "2" | "3") => {
    pushParams((params) => {
      if (params.get("occupancy") === value) {
        params.delete("occupancy");
      } else {
        params.set("occupancy", value);
      }
    });
  };

  // "Tiện ích phổ biến" — applied in page.tsx after listRooms() returns (not
  // a SQL filter). Round 12: exact (case/diacritics-insensitive) match
  // against catalog names — see roomHasAllAmenities in src/lib/amenities.ts.
  const selectedAmenities = new Set(
    (searchParams.get("amenities") ?? "").split(",").filter(Boolean)
  );

  const toggleAmenity = (keyword: string) => {
    pushParams((params) => {
      const current = new Set(
        (params.get("amenities") ?? "").split(",").filter(Boolean)
      );
      if (current.has(keyword)) {
        current.delete(keyword);
      } else {
        current.add(keyword);
      }
      if (current.size === 0) {
        params.delete("amenities");
      } else {
        params.set("amenities", Array.from(current).join(","));
      }
    });
  };

  return (
    <div
      className={`flex flex-col gap-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${
        isPending ? "opacity-70" : ""
      }`}
    >
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Trạng thái
        </h3>
        <div className="flex flex-wrap gap-2">
          {ROOM_STATUSES.map((status) => {
            const active = selectedStatuses.has(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-light)] text-[color:var(--color-accent-dark)]"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {ROOM_STATUS_LABEL[status]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Giá / tháng
        </h3>
        <div className="flex flex-wrap gap-2">
          {PRICE_BUCKETS.map((bucket) => {
            const active = selectedMin === bucket.min && selectedMax === bucket.max;
            return (
              <button
                key={bucket.key}
                type="button"
                onClick={() => toggleBucket(bucket.min, bucket.max)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-light)] text-[color:var(--color-accent-dark)]"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {bucket.label}
              </button>
            );
          })}
        </div>
        <PriceRangeSlider min={selectedMin} max={selectedMax} onChange={applyRange} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Số người ở
        </h3>
        <div className="flex flex-wrap gap-2">
          {OCCUPANCY_OPTIONS.map((opt) => {
            const active = selectedOccupancy === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleOccupancy(opt.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-light)] text-[color:var(--color-accent-dark)]"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tiện ích phổ biến
        </h3>
        <div className="flex flex-col gap-2">
          {popularAmenities.map(({ name, icon }) => (
            <label
              key={name}
              className="flex items-center gap-2 text-sm text-slate-600"
            >
              <input
                type="checkbox"
                checked={selectedAmenities.has(name)}
                onChange={() => toggleAmenity(name)}
                className="h-4 w-4 rounded border-slate-300 text-[color:var(--color-accent)] focus:ring-[color:var(--color-accent)]"
              />
              <AmenityIcon icon={icon} className="h-4 w-4 text-slate-400" />
              {name}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// "3" means "3 người trở lên" — matches listRooms()'s occupancy=3 handling
// (max_occupancy >= 3) in src/lib/db.ts.
const OCCUPANCY_OPTIONS: { value: "1" | "2" | "3"; label: string }[] = [
  { value: "1", label: "1 người" },
  { value: "2", label: "2 người" },
  { value: "3", label: "3-4 người" },
];
