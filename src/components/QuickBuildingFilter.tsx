"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * "Khu vực nhanh" — round 10, §12. One button per building/property so a
 * customer who already knows which building they want (or a sale rep on the
 * phone with one) can jump straight to it, instead of typing the address out
 * in <MainSearchBar>. Sits directly under the search bar. Writes the same
 * `propertyId` param GET /api/rooms and listRooms() already understand.
 */
export default function QuickBuildingFilter({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedPropertyId = searchParams.get("propertyId") ?? "";

  const setPropertyId = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id && id !== selectedPropertyId) {
        params.set("propertyId", id);
      } else {
        params.delete("propertyId");
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams, selectedPropertyId]
  );

  if (properties.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${isPending ? "opacity-70" : ""}`}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Khu vực nhanh:
      </span>
      {properties.map((p) => {
        const active = selectedPropertyId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => setPropertyId(p.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              active
                ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-light)] text-[color:var(--color-accent-dark)]"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
