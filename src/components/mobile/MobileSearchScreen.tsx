"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Search, LocateFixed, Clock, Building2, MapPin } from "lucide-react";
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
export default function MobileSearchScreen({
  initialQuery,
  areas,
  buildings,
  onClose,
  go,
}: {
  initialQuery: string;
  areas: SearchArea[];
  buildings: SearchBuilding[];
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

  const submit = () => {
    const q = text.trim();
    if (!q) return;
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
            placeholder="Địa chỉ, phường, tên tòa nhà…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-w-0 flex-grow bg-transparent text-[15px] outline-none"
          />
        </form>
      </div>

      <div className="flex flex-grow flex-col gap-[22px] overflow-y-auto p-4">
        {text.trim() ? (
          <button
            type="button"
            onClick={submit}
            className="-mb-2 flex min-h-11 items-center gap-2.5 text-left text-[15px]"
          >
            <Search className="h-[18px] w-[18px] flex-none text-[#5b6475]" aria-hidden />
            <span>
              Tìm “<strong>{text.trim()}</strong>”
            </span>
          </button>
        ) : null}

        <div className="flex flex-col gap-1">
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

        {recent.length > 0 ? (
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

        {areas.length > 0 ? (
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

        {buildings.length > 0 ? (
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
