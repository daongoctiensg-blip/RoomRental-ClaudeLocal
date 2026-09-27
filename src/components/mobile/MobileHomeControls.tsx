"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Check, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { ROOM_SORT_OPTIONS } from "@/types";
import {
  type FacetRoom,
  type FilterState,
  countActiveFilters,
  parseFilterState,
  writeFilterState,
} from "@/lib/roomFilters";
import { normalizeAmenityName } from "@/lib/amenities";
import MobileFilterScreen from "@/components/mobile/MobileFilterScreen";
import MobileSearchScreen, {
  type SearchArea,
  type SearchBuilding,
} from "@/components/mobile/MobileSearchScreen";

// Location params — replaced as a group by the search screen.
const LOCATION_KEYS = ["city", "ward", "district", "address", "near", "propertyId", "saved"];

const QUICK_PRICES = [
  { label: "4 - 6 triệu", min: 4_000_000, max: 6_000_000 },
  { label: "6 - 8 triệu", min: 6_000_000, max: 8_000_000 },
];

/**
 * Top of the mobile homepage — round 13 (Claude Design board "1 · Trang
 * chủ"): the big search box, the "Sắp xếp · Bộ lọc (N) · Khu vực" row and
 * one-tap chips. Opens the full-screen search / filter screens and the sort
 * sheet. All state lives in the URL, same params as the desktop sidebar.
 */
export default function MobileHomeControls({
  title,
  facets,
  popularAmenities,
  areas,
  buildings,
}: {
  /** What the search box shows: the current place / keyword / building. */
  title: string;
  facets: FacetRoom[];
  popularAmenities: string[];
  areas: SearchArea[];
  buildings: SearchBuilding[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [layer, setLayer] = useState<"search" | "filter" | "sort" | null>(null);
  const close = useCallback(() => setLayer(null), []);

  const filters = parseFilterState((k) => searchParams.get(k));
  const active = countActiveFilters(filters);
  const sort = searchParams.get("sort") ?? "default";

  const push = (params: URLSearchParams) => {
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };
  const applyFilters = (next: FilterState) => {
    const params = new URLSearchParams(searchParams.toString());
    writeFilterState(params, next);
    setLayer(null);
    push(params);
  };
  const goLocation = (query: string) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of LOCATION_KEYS) params.delete(k);
    for (const [k, v] of new URLSearchParams(query)) params.set(k, v);
    setLayer(null);
    push(params);
  };
  const setSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "default") params.delete("sort");
    else params.set("sort", value);
    setLayer(null);
    push(params);
  };

  const hasAmenity = (name: string) =>
    filters.amenities.some((a) => normalizeAmenityName(a) === normalizeAmenityName(name));
  const chips = [
    ...popularAmenities.slice(0, 2).map((name) => ({
      label: name,
      on: hasAmenity(name),
      toggle: () =>
        applyFilters({
          ...filters,
          amenities: hasAmenity(name)
            ? filters.amenities.filter((a) => normalizeAmenityName(a) !== normalizeAmenityName(name))
            : [...filters.amenities, name],
        }),
    })),
    {
      label: "Ban công",
      on: filters.balcony,
      toggle: () => applyFilters({ ...filters, balcony: !filters.balcony }),
    },
    ...popularAmenities.slice(2, 3).map((name) => ({
      label: name,
      on: hasAmenity(name),
      toggle: () =>
        applyFilters({
          ...filters,
          amenities: hasAmenity(name)
            ? filters.amenities.filter((a) => normalizeAmenityName(a) !== normalizeAmenityName(name))
            : [...filters.amenities, name],
        }),
    })),
    ...QUICK_PRICES.map((p) => {
      const on = filters.priceMin === p.min && filters.priceMax === p.max;
      return {
        label: p.label,
        on,
        toggle: () =>
          applyFilters(
            on
              ? { ...filters, priceMin: 0, priceMax: null }
              : { ...filters, priceMin: p.min, priceMax: p.max }
          ),
      };
    }),
  ];

  const rowBtn = "flex h-11 flex-1 items-center justify-center gap-1.5 text-sm";

  return (
    <div className="flex-none bg-white px-3 pt-2.5">
      <button
        type="button"
        onClick={() => setLayer("search")}
        className="flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-[#dfe3ea] bg-[#f7f9fc] px-3.5 py-1.5 text-left"
      >
        <Search className="h-[18px] w-[18px] flex-none text-[#2f6fed]" aria-hidden />
        <span className="flex min-w-0 flex-col gap-px">
          <span className="truncate text-[15px] font-semibold">{title}</span>
          <span className="text-xs text-[#5b6475]">Tìm theo địa chỉ, khu vực, tên tòa nhà…</span>
        </span>
      </button>

      <div className="mt-2 flex border-b border-[#eef1f5]">
        <button type="button" onClick={() => setLayer("sort")} className={rowBtn}>
          <ArrowDownUp className="h-4 w-4" aria-hidden />
          Sắp xếp
        </button>
        <button
          type="button"
          onClick={() => setLayer("filter")}
          className={`${rowBtn} ${active ? "font-bold text-[#1d4fbf]" : ""}`}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {active ? `Bộ lọc (${active})` : "Bộ lọc"}
        </button>
        <button type="button" onClick={() => setLayer("search")} className={rowBtn}>
          <MapPin className="h-4 w-4" aria-hidden />
          Khu vực
        </button>
      </div>

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none]">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            aria-pressed={c.on}
            onClick={c.toggle}
            className={`h-[34px] flex-none whitespace-nowrap rounded-lg px-3 text-[13px] ${
              c.on
                ? "border-[1.5px] border-[#2f6fed] bg-[#eaf1ff] font-semibold text-[#1d4fbf]"
                : "border border-[#dfe3ea] bg-white"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {layer === "search" ? (
        <MobileSearchScreen
          initialQuery={searchParams.get("address") ?? ""}
          areas={areas}
          buildings={buildings}
          onClose={close}
          go={goLocation}
        />
      ) : null}
      {layer === "filter" ? (
        <MobileFilterScreen
          initial={filters}
          facets={facets}
          amenities={popularAmenities}
          onClose={close}
          onApply={applyFilters}
        />
      ) : null}
      {layer === "sort" ? (
        <div className="fixed inset-0 z-[1000] flex flex-col justify-end bg-black/40" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sắp xếp"
            onClick={(e) => e.stopPropagation()}
            className="rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex h-14 items-center justify-between border-b border-[#eef1f5] pl-4 pr-2">
              <h2 className="text-[17px] font-bold">Sắp xếp</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Đóng"
                className="flex h-11 w-11 items-center justify-center"
              >
                <X className="h-[22px] w-[22px]" aria-hidden />
              </button>
            </div>
            {ROOM_SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setSort(o.value)}
                className={`flex min-h-12 w-full items-center justify-between border-b border-[#f1f4f8] px-4 text-left text-[15px] ${
                  sort === o.value ? "font-semibold text-[#1d4fbf]" : ""
                }`}
              >
                {o.label}
                {sort === o.value ? <Check className="h-5 w-5" aria-hidden /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
