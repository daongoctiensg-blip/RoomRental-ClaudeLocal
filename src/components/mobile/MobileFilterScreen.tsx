"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import FullScreen from "@/components/mobile/FullScreen";
import PriceRangeSlider, { PRICE_SLIDER_MAX } from "@/components/PriceRangeSlider";
import { PRICE_BUCKETS } from "@/lib/priceBuckets";
import { ROOM_STATUSES, ROOM_STATUS_LABEL, type RoomStatus } from "@/types";
import { normalizeAmenityName } from "@/lib/amenities";
import {
  DEFAULT_STATUSES,
  type FacetRoom,
  type FilterState,
  matchesFilters,
} from "@/lib/roomFilters";

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "₫";
const BAR_COUNT = 20; // one bar per 1 triệu, 0 → 20 triệu (last bar = 19tr+)

function parseMoney(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  // "6" or "6.5" typed by a customer means triệu, not 6₫.
  return n > 0 && n < 1000 ? Math.round(n * 1_000_000) : n;
}

function Pill({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`h-9 rounded-lg px-3 text-[13px] ${
        on
          ? "border-[1.5px] border-[#2f6fed] bg-[#eaf1ff] font-semibold text-[#1d4fbf]"
          : "border border-[#dfe3ea] bg-white text-[#16233b] disabled:text-[#9aa3b2]"
      }`}
    >
      {children}
    </button>
  );
}

function MoneyInput({
  label,
  aria,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  aria: string;
  value: string;
  placeholder: string;
  onCommit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-[10px] border border-[#dfe3ea] px-2.5 py-1.5">
      <span className="text-[11px] text-[#5b6475]">{label}</span>
      <input
        inputMode="numeric"
        aria-label={aria}
        value={draft ?? value}
        placeholder={placeholder}
        onFocus={() => setDraft(value.replace(/\D/g, ""))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) onCommit(draft);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-full min-w-0 bg-transparent p-0 text-[15px] font-semibold outline-none"
      />
    </label>
  );
}

/**
 * Full-screen "Lọc theo" — round 13 (Claude Design board "3 · Lọc theo").
 * Works on a draft copy of the filters; every count is computed live in
 * the browser from `facets` (the rooms for the current location) with the
 * same matchesFilters() the server uses, so "Xem kết quả (N)" is exactly
 * what the list will show. Options that would give 0 rooms are dimmed and
 * disabled rather than hidden, so the customer sees what exists.
 */
export default function MobileFilterScreen({
  initial,
  facets,
  amenities,
  onClose,
  onApply,
  showStatus = false,
}: {
  initial: FilterState;
  facets: FacetRoom[];
  amenities: string[];
  onClose: () => void;
  onApply: (next: FilterState) => void;
  /** Round 15: admin-only (guests only see available rooms). */
  showStatus?: boolean;
}) {
  const [draft, setDraft] = useState<FilterState>(initial);
  const patch = (p: Partial<FilterState>) => setDraft((d) => ({ ...d, ...p }));

  const count = (s: FilterState) => facets.filter((r) => matchesFilters(r, s)).length;
  const total = count(draft);

  // Histogram of prices among rooms matching everything except price.
  const bars = useMemo(() => {
    const counts = new Array<number>(BAR_COUNT).fill(0);
    for (const r of facets) {
      if (!matchesFilters(r, draft, "price")) continue;
      counts[Math.min(BAR_COUNT - 1, Math.floor(r.price / 1_000_000))]++;
    }
    const max = Math.max(1, ...counts);
    return counts.map((n, i) => {
      const lo = i * 1_000_000;
      const inRange = lo + 1_000_000 > draft.priceMin && (draft.priceMax === null || lo < draft.priceMax);
      return { n, h: n ? 8 + Math.round((n / max) * 36) : 4, inRange };
    });
  }, [facets, draft]);

  const toggleAmenity = (name: string) => {
    const key = normalizeAmenityName(name);
    const has = draft.amenities.some((a) => normalizeAmenityName(a) === key);
    patch({
      amenities: has
        ? draft.amenities.filter((a) => normalizeAmenityName(a) !== key)
        : [...draft.amenities, name],
    });
  };
  const toggleStatus = (s: RoomStatus) => {
    const has = draft.statuses.includes(s);
    // Keep at least one status: an empty list would silently fall back to
    // the "Còn trống" default in the URL.
    if (has && draft.statuses.length === 1) return;
    patch({ statuses: has ? draft.statuses.filter((x) => x !== s) : [...draft.statuses, s] });
  };

  const reset = () =>
    setDraft({
      statuses: DEFAULT_STATUSES,
      priceMin: 0,
      priceMax: null,
      occupancy: null,
      amenities: [],
      balcony: false,
    });

  const amenityRows = [
    ...amenities.map((name) => {
      const on = draft.amenities.some((a) => normalizeAmenityName(a) === normalizeAmenityName(name));
      return {
        key: `a:${name}`,
        label: name,
        on,
        n: count({ ...draft, amenities: on ? draft.amenities : [...draft.amenities, name] }),
        toggle: () => toggleAmenity(name),
      };
    }),
    {
      key: "balcony",
      label: "Ban công",
      on: draft.balcony,
      n: count({ ...draft, balcony: true }),
      toggle: () => patch({ balcony: !draft.balcony }),
    },
  ];

  return (
    <FullScreen label="Lọc theo" onClose={onClose}>
      <div className="flex h-14 flex-none items-center justify-between border-b border-[#eef1f5] px-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="flex h-11 w-11 items-center justify-center"
        >
          <X className="h-[22px] w-[22px]" aria-hidden />
        </button>
        <h1 className="text-[17px] font-bold">Lọc theo</h1>
        <button type="button" onClick={reset} className="h-11 px-2.5 text-sm font-semibold text-[#1d4fbf]">
          Đặt lại
        </button>
      </div>

      <div className="flex flex-grow flex-col gap-[22px] overflow-y-auto px-4 pb-6 pt-4">
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[15px] font-bold">Giá thuê / tháng</h2>
          <div className="flex h-11 items-end gap-[3px] px-1" aria-hidden>
            {bars.map((b, i) => (
              <span
                key={i}
                className="flex-1 rounded-t-sm"
                style={{
                  height: b.h,
                  background: b.n ? (b.inRange ? "#9db8f5" : "#cbd5e1") : "#e3e7ee",
                }}
              />
            ))}
          </div>
          <div className="-mt-3 px-1">
            <PriceRangeSlider
              min={draft.priceMin}
              max={draft.priceMax}
              onChange={(nextMin, nextMax) => patch({ priceMin: nextMin, priceMax: nextMax })}
            />
          </div>
          <div className="flex items-center gap-2.5">
            <MoneyInput
              label="Tối thiểu"
              aria="Nhập giá tối thiểu"
              value={vnd(draft.priceMin)}
              placeholder="0₫"
              onCommit={(raw) => {
                const n = parseMoney(raw) ?? 0;
                patch({
                  priceMin: Math.max(0, Math.min(n, (draft.priceMax ?? Infinity) - 100_000)),
                });
              }}
            />
            <span className="text-[#5b6475]">—</span>
            <MoneyInput
              label="Tối đa"
              aria="Nhập giá tối đa"
              value={draft.priceMax === null ? `${vnd(PRICE_SLIDER_MAX)}+` : vnd(draft.priceMax)}
              placeholder={`${vnd(PRICE_SLIDER_MAX)}+`}
              onCommit={(raw) => {
                const n = parseMoney(raw);
                patch({
                  priceMax:
                    n === null || n >= PRICE_SLIDER_MAX ? null : Math.max(n, draft.priceMin + 100_000),
                });
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRICE_BUCKETS.map((b) => {
              const on = draft.priceMin === b.min && draft.priceMax === b.max;
              const n = count({ ...draft, priceMin: b.min, priceMax: b.max });
              return (
                <Pill
                  key={b.key}
                  on={on}
                  disabled={!on && n === 0}
                  onClick={() =>
                    patch(on ? { priceMin: 0, priceMax: null } : { priceMin: b.min, priceMax: b.max })
                  }
                >
                  {b.label} <span className="text-[#5b6475]">({n})</span>
                </Pill>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-0.5">
          <h2 className="mb-1.5 text-[15px] font-bold">Tiện ích phổ biến</h2>
          {amenityRows.map((a) => {
            const off = !a.on && a.n === 0;
            return (
              <label
                key={a.key}
                className={`flex min-h-11 items-center gap-3 border-b border-[#f1f4f8] text-[15px] ${
                  off ? "text-[#9aa3b2]" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={a.on}
                  disabled={off}
                  onChange={a.toggle}
                  className="m-0 h-5 w-5 accent-[#2f6fed]"
                />
                <span className="flex-grow">{a.label}</span>
                <span className="text-[13px] text-[#5b6475]">{a.n}</span>
              </label>
            );
          })}
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[15px] font-bold">Số người ở</h2>
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3] as const).map((o) => {
              const on = draft.occupancy === o;
              const n = count({ ...draft, occupancy: o });
              return (
                <Pill
                  key={o}
                  on={on}
                  disabled={!on && n === 0}
                  onClick={() => patch({ occupancy: on ? null : o })}
                >
                  {o === 3 ? "3 người trở lên" : `${o} người`} ({n})
                </Pill>
              );
            })}
          </div>
        </section>

        {showStatus ? (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[15px] font-bold">Trạng thái</h2>
          <div className="flex flex-wrap gap-2">
            {ROOM_STATUSES.map((s) => {
              const on = draft.statuses.includes(s);
              const n = facets.filter(
                (r) => r.status === s && matchesFilters(r, draft, "status")
              ).length;
              return (
                <Pill key={s} on={on} onClick={() => toggleStatus(s)}>
                  {ROOM_STATUS_LABEL[s]} ({n})
                </Pill>
              );
            })}
          </div>
        </section>
        ) : null}
      </div>

      <div className="flex-none border-t border-[#eef1f5] bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => onApply(draft)}
          className="flex h-[50px] w-full items-center justify-center rounded-xl bg-[#2f6fed] text-base font-bold text-white"
        >
          Xem kết quả ({total})
        </button>
      </div>
    </FullScreen>
  );
}
