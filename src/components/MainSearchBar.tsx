"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import vnProvinces from "@/data/vn-provinces.json";
import vnWards from "@/data/vn-wards.json";
import vnHcmDistricts from "@/data/vn-hcm-districts.json";
import SearchableSelect from "@/components/SearchableSelect";

/**
 * The primary, always-visible search controls: free-text address search plus
 * the city/ward/district exact-match dropdowns. Moved to the top of the page
 * (full width, above the listing) per the owner's request — these are the
 * filters people reach for first, so they shouldn't be tucked away in a
 * sidebar. Secondary refinements (status, price bucket) stay in <FilterBar>
 * below the listing grid.
 *
 * City/ward options come from a bundled master list of Vietnam's official
 * administrative divisions (34 provinces/cities, ~3,320 wards/communes,
 * post the July 2025 merger — see src/data/vn-provinces.json /
 * vn-wards.json, sourced from https://github.com/zuydd/vn-geo) — NOT derived
 * from which properties currently exist. A customer can pick any real
 * province/ward even if this platform doesn't have a listing there yet; an
 * earlier version derived the list from existing properties instead, which
 * meant the dropdowns were empty (or vanished entirely) until at least one
 * property had its city/ward filled in — the owner explicitly asked for the
 * full official list instead.
 *
 * Quận/Huyện is a separate, independent dropdown tied to the OLD
 * pre-2025 address system (addressOld) rather than the new city/ward
 * hierarchy — kept because many customers still search/think in terms of
 * the old district names. Currently only Hồ Chí Minh City's 22 pre-merger
 * districts are bundled (src/data/vn-hcm-districts.json) since that's
 * where this platform's properties actually are; extending to other
 * provinces' old districts would need their own pre-2025 district lists.
 */
export default function MainSearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [addressInput, setAddressInput] = useState(
    searchParams.get("address") ?? ""
  );

  const selectedCity = (() => {
    const raw = searchParams.get("city");
    if (raw === null) return "Thành phố Hồ Chí Minh"; // matches page.tsx's default
    if (raw === "all") return "";
    return raw;
  })();
  const selectedWard = searchParams.get("ward") ?? "";
  const selectedDistrict = searchParams.get("district") ?? "";

  const provinceCodeByName = useMemo(
    () => new Map(vnProvinces.map((p) => [p.name, p.code])),
    []
  );
  const wardsForSelectedCity = useMemo(() => {
    const code = provinceCodeByName.get(selectedCity);
    if (!code) return [];
    return vnWards.filter((w) => w.pc === code).map((w) => w.w);
  }, [provinceCodeByName, selectedCity]);

  const cityOptions = useMemo(
    () => [
      { value: "", label: "Tất cả thành phố / tỉnh" },
      ...vnProvinces.map((p) => ({ value: p.name, label: p.name })),
    ],
    []
  );
  const wardOptions = useMemo(
    () => [
      { value: "", label: selectedCity ? "Tất cả phường / xã" : "Chọn tỉnh/thành trước" },
      ...wardsForSelectedCity.map((w) => ({ value: w, label: w })),
    ],
    [selectedCity, wardsForSelectedCity]
  );
  const districtOptions = useMemo(
    () => [
      { value: "", label: "Tất cả quận / huyện" },
      ...vnHcmDistricts.map((d) => ({ value: d, label: d })),
    ],
    []
  );

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

  const submitAddress = (e: React.FormEvent) => {
    e.preventDefault();
    pushParams((params) => {
      if (addressInput.trim()) {
        params.set("address", addressInput.trim());
      } else {
        params.delete("address");
      }
    });
  };

  const setCity = (value: string) => {
    pushParams((params) => {
      if (value) {
        params.set("city", value);
      } else {
        // Explicit "Tất cả thành phố / tỉnh" — set the "all" marker rather
        // than deleting the param, so this choice sticks instead of
        // silently reverting to the default city (Thành phố Hồ Chí Minh)
        // on the next render.
        params.set("city", "all");
      }
      // Ward list depends on the selected city — an old ward selection from
      // a different city would silently filter out everything, so clear it.
      params.delete("ward");
    });
  };

  const setWard = (value: string) => {
    pushParams((params) => {
      if (value) {
        params.set("ward", value);
      } else {
        params.delete("ward");
      }
    });
  };

  const setDistrict = (value: string) => {
    pushParams((params) => {
      if (value) {
        params.set("district", value);
      } else {
        params.delete("district");
      }
    });
  };

  const hasAnyFilter =
    Boolean(searchParams.get("address")) ||
    Boolean(selectedCity) ||
    Boolean(selectedWard) ||
    Boolean(selectedDistrict) ||
    Boolean(searchParams.get("priceBucket")) ||
    Boolean(searchParams.get("status"));

  const clearAll = () => {
    setAddressInput("");
    startTransition(() => {
      // "Xoá bộ lọc" means truly everything, everywhere — push city=all
      // explicitly rather than just clearing all params, otherwise the
      // absent city param would immediately re-trigger the Hồ Chí Minh
      // default in page.tsx and this button would look like it did nothing.
      router.push(`${pathname}?city=all`);
    });
  };

  return (
    <div
      className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${
        isPending ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <form onSubmit={submitAddress} className="flex flex-1 gap-2">
          <input
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="Tìm theo địa chỉ, khu vực…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--color-accent)] focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-accent-dark)]"
          >
            Tìm
          </button>
        </form>

        <div className="flex flex-col gap-2 sm:flex-row md:w-[620px] md:shrink-0">
          <SearchableSelect
            value={selectedCity}
            onChange={setCity}
            options={cityOptions}
            placeholder="Gõ để tìm tỉnh/thành…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--color-accent)] focus:outline-none sm:w-1/3"
          />
          <SearchableSelect
            value={selectedWard}
            onChange={setWard}
            options={wardOptions}
            disabled={!selectedCity}
            placeholder={selectedCity ? "Gõ để tìm phường/xã…" : "Chọn tỉnh/thành trước"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--color-accent)] focus:outline-none disabled:opacity-50 sm:w-1/3"
          />
          <SearchableSelect
            value={selectedDistrict}
            onChange={setDistrict}
            options={districtOptions}
            placeholder="Gõ để tìm quận/huyện…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--color-accent)] focus:outline-none sm:w-1/3"
          />
        </div>

        {hasAnyFilter ? (
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 self-center text-xs font-medium text-slate-500 underline-offset-2 hover:underline md:self-stretch md:px-1"
          >
            Xoá bộ lọc
          </button>
        ) : null}
      </div>
    </div>
  );
}

