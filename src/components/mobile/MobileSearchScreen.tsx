"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Search, LocateFixed, Clock, Building2, MapPin, Landmark, Map as MapIcon } from "lucide-react";
import {
  type LocationCounts,
  type LocationHit,
  type LocationKind,
  enterLocationHit,
  searchLocations,
} from "@/lib/locationSearch";
import RoomPhoto from "@/components/RoomPhoto";
import FullScreen from "@/components/mobile/FullScreen";
import {
  type RecentSearch,
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
} from "@/lib/recentSearches";

export interface SearchArea {
  label: string;
  count: number;
  /** Homepage query string (without "?"). */
  query: string;
  sub: string;
}

export interface SearchBuilding {
  id: string;
  name: string;
  address: string;
  ward: string;
  photo?: string;
  available: number;
}

/**
 * Mobile search screen — round 13 (Claude Design board "2 · Tìm kiếm").
 * Everything here navigates the homepage by query string; nothing is
 * searched client-side. "Phòng gần vị trí của tôi" asks the browser for its
 * location and opens `/?near=lat,lng` (rooms within 2 km, nearest first —
 * see listRooms' `near` filter).
 */
const KIND_ICON: Record<LocationKind, typeof MapPin> = {
  city: Landmark,
  ward: MapPin,
  district: MapIcon,
  building: Building2,
};
const KIND_TITLE: Record<LocationKind, string> = {
  building: "Tòa nhà",
  ward: "Phường / Xã",
  district: "Quận / Huyện (cũ)",
  city: "Tỉnh / Thành phố",
};
const KIND_ORDER: LocationKind[] = ["building", "ward", "district", "city"];

export default function MobileSearchScreen({
  initialQuery,
  areas,
  buildings,
  counts,
  currentCity,
  onClose,
  go,
}: {
  initialQuery: string;
  areas: SearchArea[];
  buildings: SearchBuilding[];
  /** Round 16: available-room counts per city / ward / old district. */
  counts: LocationCounts;
  currentCity?: string;
  onClose: () => void;
  /** Replace the location part of the URL with `query` and close. */
  go: (query: string) => void;
}) {
  const [text, setText] = useState(initialQuery);
  // Only ever mounted after a tap (never server-rendered), so reading
  // localStorage in the initializer is safe.
  const [recent, setRecent] = useState<RecentSearch[]>(() => getRecentSearches());
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const open = (entry: RecentSearch) => {
    addRecentSearch(entry);
    go(entry.query);
  };

  // Round 16: type-ahead over the official province / ward / old-district
  // lists + buildings (src/lib/locationSearch.ts).
  const hits = useMemo(
    () =>
      searchLocations(text, {
        counts,
        currentCity,
        buildings: buildings.map((b) => ({
          id: b.id,
          name: b.name,
          address: b.address,
          ward: b.ward,
          available: b.available,
        })),
      }),
    [text, counts, currentCity, buildings]
  );
  const openHit = (h: LocationHit) =>
    open({
      title: h.label,
      sub: h.kind === "building" ? "Tòa nhà" : h.sub,
      query: h.query,
    });

  const submit = () => {
    const q = text.trim();
    if (!q) return;
    const best = enterLocationHit(q, hits);
    if (best) {
      openHit(best);
      return;
    }
    open({
      title: q,
      sub: "Tìm theo từ khoá",
      query: `city=all&address=${encodeURIComponent(q)}`,
    });
  };

  const nearMe = () => {
    setLocError(null);
    if (!("geolocation" in navigator)) {
      setLocError("Trình duyệt không hỗ trợ lấy vị trí.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        go(`city=all&near=${lat},${lng}`);
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Anh/chị chưa cho phép truy cập vị trí. Bật quyền vị trí cho trang này rồi thử lại."
            : "Không lấy được vị trí hiện tại. Thử lại sau."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <FullScreen label="Tìm kiếm phòng" onClose={onClose}>
      <div className="flex flex-none items-center gap-1 border-b border-[#eef1f5] py-2.5 pl-1 pr-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Quay lại"
          className="flex h-11 w-11 items-center justify-center"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <form
          className="flex h-11 flex-grow items-center gap-2 rounded-[10px] border-[1.5px] border-[#2f6fed] px-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Search className="h-[18px] w-[18px] flex-none text-[#2f6fed]" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            aria-label="Tìm phòng"
            placeholder="Tỉnh/thành, phường, quận, tòa nhà…"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-w-0 flex-grow bg-transparent text-[15px] outline-none"
          />
        </form>
      </div>

      <div className="flex flex-grow flex-col gap-[22px] overflow-y-auto p-4">
        {text.trim() ? (
          <div className="-mt-1 flex flex-col">
            {/* Groups in order of their best match (hits are pre-sorted). */}
            {KIND_ORDER.filter((k) => hits.some((h) => h.kind === k))
              .sort((a, b) => hits.findIndex((h) => h.kind === a) - hits.findIndex((h) => h.kind === b))
              .map((k) => (
              <section key={k} className="flex flex-col pb-2">
                <h2 className="pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[#5b6475]">
                  {KIND_TITLE[k]}
                </h2>
                {hits
                  .filter((h) => h.kind === k)
                  .map((h) => {
                    const Icon = KIND_ICON[h.kind];
                    return (
                      <button
                        key={h.query}
                        type="button"
                        onClick={() => openHit(h)}
                        className="flex min-h-12 items-center gap-3 border-b border-[#f1f4f8] text-left"
                      >
                        <Icon className="h-[18px] w-[18px] flex-none text-[#2f6fed]" aria-hidden />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[15px]">{h.label}</span>
                          <span className="truncate text-xs text-[#5b6475]">
                            {h.sub}
                            {" · "}
                            {h.count > 0 ? (
                              <span className="font-medium text-[#15803d]">{h.count} phòng trống</span>
                            ) : (
                              <span>chưa có phòng trống</span>
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
              </section>
            ))}
            <button
              type="button"
              onClick={() =>
                open({
                  title: text.trim(),
                  sub: "Tìm theo từ khoá",
                  query: `city=all&address=${encodeURIComponent(text.trim())}`,
                })
              }
              className="flex min-h-12 items-center gap-3 text-left text-[15px]"
            >
              <Search className="h-[18px] w-[18px] flex-none text-[#5b6475]" aria-hidden />
              <span>
                Tìm theo từ khoá “<strong>{text.trim()}</strong>”
                {hits.length === 0 ? (
                  <span className="block text-xs text-[#5b6475]">
                    Không thấy tỉnh/thành, phường hay tòa nhà nào khớp — thử gõ ngắn hơn, vd “phú thuận”, “q7”, “hcm”.
                  </span>
                ) : null}
              </span>
            </button>
          </div>
        ) : null}

        <div className={`flex flex-col gap-1 ${text.trim() ? "hidden" : ""}`}>
          <button
            type="button"
            onClick={nearMe}
            disabled={locating}
            className="flex h-11 items-center gap-2.5 text-left text-[15px] font-semibold text-[#1d4fbf] disabled:opacity-60"
          >
            <LocateFixed className="h-5 w-5" aria-hidden />
            {locating ? "Đang lấy vị trí…" : "Phòng gần vị trí của tôi (2 km)"}
          </button>
          {locError ? <p className="text-[13px] text-rose-600">{locError}</p> : null}
        </div>

        {!text.trim() && recent.length > 0 ? (
          <section className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-bold">Tìm kiếm gần đây</h2>
              <button
                type="button"
                onClick={() => {
                  clearRecentSearches();
                  setRecent([]);
                }}
                className="py-2 text-[13px] text-[#5b6475]"
              >
                Xoá
              </button>
            </div>
            {recent.map((r) => (
              <button
                key={r.query}
                type="button"
                onClick={() => open(r)}
                className="flex min-h-12 items-center gap-3 border-b border-[#f1f4f8] text-left"
              >
                <Clock className="h-[18px] w-[18px] flex-none text-[#5b6475]" aria-hidden />
                <span className="flex flex-col">
                  <span className="text-[15px]">{r.title}</span>
                  <span className="text-xs text-[#5b6475]">{r.sub}</span>
                </span>
              </button>
            ))}
          </section>
        ) : null}

        {!text.trim() && areas.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold">Khu vực đang có phòng trống</h2>
            <div className="flex flex-wrap gap-2">
              {areas.map((a) => (
                <button
                  key={a.query}
                  type="button"
                  onClick={() => open({ title: a.label, sub: a.sub, query: a.query })}
                  className="flex h-10 items-center gap-1.5 rounded-full border border-[#dfe3ea] px-3.5 text-sm"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#5b6475]" aria-hidden />
                  {a.label} <span className="text-xs text-[#5b6475]">{a.count}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {!text.trim() && buildings.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold">Tòa nhà</h2>
            {buildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() =>
                  open({
                    title: b.name,
                    sub: "Tòa nhà",
                    query: `city=all&propertyId=${encodeURIComponent(b.id)}`,
                  })
                }
                className="flex items-center gap-3 rounded-xl border border-[#e8ebf1] p-2.5 text-left"
              >
                {b.photo ? (
                  <RoomPhoto
                    src={b.photo}
                    alt=""
                    className="h-12 w-16 flex-none rounded-lg bg-[#e9edf3] object-contain"
                  />
                ) : (
                  <span className="flex h-12 w-16 flex-none items-center justify-center rounded-lg bg-[#e9edf3]">
                    <Building2 className="h-5 w-5 text-[#6b7588]" aria-hidden />
                  </span>
                )}
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{b.name}</span>
                  <span className="text-xs text-[#5b6475]">
                    {b.ward ? `${b.ward} · ` : ""}
                    {b.available} phòng trống
                  </span>
                </span>
              </button>
            ))}
          </section>
        ) : null}
      </div>
    </FullScreen>
  );
}
