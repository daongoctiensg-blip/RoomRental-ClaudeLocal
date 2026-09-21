"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type LocationOption = { city: string; ward: string };

/**
 * The primary, always-visible search controls: free-text address search plus
 * the city/ward exact-match dropdowns. Moved to the top of the page (full
 * width, above the listing) per the owner's request — these are the filters
 * people reach for first, so they shouldn't be tucked away in a sidebar.
 * Secondary refinements (status, price bucket) stay in <FilterBar> below the
 * listing grid.
 */
export default function MainSearchBar({
  locationOptions = [],
}: {
  /** Every distinct {city, ward} pair that actually has an active property
   * — the dropdowns only ever offer choices that can return results. */
  locationOptions?: LocationOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [addressInput, setAddressInput] = useState(
    searchParams.get("address") ?? ""
  );

  const selectedCity = searchParams.get("city") ?? "";
  const selectedWard = searchParams.get("ward") ?? "";

  const cities = Array.from(new Set(locationOptions.map((o) => o.city))).sort();
  const wardsForSelectedCity = Array.from(
    new Set(
      locationOptions
        .filter((o) => !selectedCity || o.city === selectedCity)
        .map((o) => o.ward)
    )
  ).sort();

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
        params.delete("city");
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

  const hasAnyFilter =
    Boolean(searchParams.get("address")) ||
    Boolean(selectedCity) ||
    Boolean(selectedWard) ||
    Boolean(searchParams.get("priceBucket")) ||
    Boolean(searchParams.get("status"));

  const clearAll = () => {
    setAddressInput("");
    startTransition(() => {
      router.push(pathname);
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

        {cities.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row md:w-[420px] md:shrink-0">
            <select
              value={selectedCity}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--color-accent)] focus:outline-none sm:w-1/2"
            >
              <option value="">Tất cả thành phố / tỉnh</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <select
              value={selectedWard}
              onChange={(e) => setWard(e.target.value)}
              disabled={wardsForSelectedCity.length === 0}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--color-accent)] focus:outline-none disabled:opacity-50 sm:w-1/2"
            >
              <option value="">Tất cả phường / xã</option>
              {wardsForSelectedCity.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>
          </div>
        ) : null}

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
