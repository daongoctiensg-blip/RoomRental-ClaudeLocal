"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { ROOM_STATUSES, ROOM_STATUS_LABEL, type RoomStatus } from "@/types";
import { PRICE_BUCKETS } from "@/lib/priceBuckets";

type LocationOption = { city: string; ward: string };

export default function FilterBar({
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

  const selectedStatuses = new Set(
    (searchParams.get("status") ?? "available").split(",").filter(Boolean)
  );
  const selectedBucket = searchParams.get("priceBucket");

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

  const clearAll = () => {
    setAddressInput("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  return (
    <div
      className={`flex flex-col gap-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${
        isPending ? "opacity-70" : ""
      }`}
    >
      <form onSubmit={submitAddress} className="flex gap-2">
        <input
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          placeholder="Tìm theo địa chỉ, khu vực…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--color-accent)] focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-accent-dark)]"
        >
          Tìm
        </button>
      </form>

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

      {cities.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hoặc chọn khu vực
          </h3>
          <select
            value={selectedCity}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--color-accent)] focus:outline-none"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--color-accent)] focus:outline-none disabled:opacity-50"
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

      <button
        type="button"
        onClick={clearAll}
        className="self-start text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
      >
        Xoá bộ lọc
      </button>
    </div>
  );
}
