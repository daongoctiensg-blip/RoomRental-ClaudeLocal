"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { ROOM_STATUSES, ROOM_STATUS_LABEL, type RoomStatus } from "@/types";
import { PRICE_BUCKETS } from "@/lib/priceBuckets";

/**
 * Secondary refinement filters (status, price bucket). The primary search
 * controls (free-text address, city/ward) live in <MainSearchBar> at the top
 * of the page instead — this bar sits alongside the results as a narrower
 * "refine further" panel.
 */
export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedStatuses = new Set(
    (searchParams.get("status") ?? "available").split(",").filter(Boolean)
  );
  const selectedBucket = searchParams.get("priceBucket");

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

  const toggleBucket = (key: string) => {
    pushParams((params) => {
      if (params.get("priceBucket") === key) {
        params.delete("priceBucket");
      } else {
        params.set("priceBucket", key);
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
            const active = selectedBucket === bucket.key;
            return (
              <button
                key={bucket.key}
                type="button"
                onClick={() => toggleBucket(bucket.key)}
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
      </div>
    </div>
  );
}
