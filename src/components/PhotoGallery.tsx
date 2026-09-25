"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, LayoutGrid, X } from "lucide-react";
import RoomPhoto from "@/components/RoomPhoto";
import { assetUrl } from "@/lib/basePath";

const MAX_THUMBS = 6;

type View = { kind: "closed" } | { kind: "album" } | { kind: "viewer"; index: number };

/**
 * Room detail photo block — round 12, trip.com-style (replaces round 11's
 * 1 + 4 grid + simple lightbox):
 *   - 1 large photo + up to 6 thumbnails; when there are more photos than
 *     fit, the last thumbnail carries a "Xem tất cả N ảnh" overlay.
 *   - "Album" view: every photo in a grid (trip.com's "Quay lại Album").
 *   - Viewer: big photo with prev/next + counter, a clickable thumbnail
 *     strip underneath, and a room-info side panel on the right (passed in
 *     from the server page as `sidePanel`, so it shows exactly the same
 *     public/admin-safe data as the rest of the page).
 *
 * Keeps AI 1's fixed-frame fix (34fa9f5): every photo box has a fixed
 * height and uses object-contain on a neutral backdrop, so photos of any
 * aspect ratio never stretch the layout or get cropped.
 */
export default function PhotoGallery({
  photos: rawPhotos,
  roomCode,
  sidePanel,
}: {
  photos: (string | undefined)[];
  roomCode: string;
  sidePanel?: React.ReactNode;
}) {
  const photos = rawPhotos.filter((p): p is string => Boolean(p));
  const [view, setView] = useState<View>({ kind: "closed" });
  const stripRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setView({ kind: "closed" }), []);
  const go = useCallback(
    (delta: number) =>
      setView((v) =>
        v.kind === "viewer"
          ? { kind: "viewer", index: (v.index + delta + photos.length) % photos.length }
          : v
      ),
    [photos.length]
  );

  useEffect(() => {
    if (view.kind === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (view.kind === "viewer" && e.key === "ArrowLeft") go(-1);
      else if (view.kind === "viewer" && e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    // Stop the page behind the overlay from scrolling.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [view.kind, close, go]);

  // Keep the active thumbnail visible in the strip.
  const activeIndex = view.kind === "viewer" ? view.index : -1;
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeIndex]);

  if (photos.length === 0) {
    return (
      <RoomPhoto
        alt={`Phòng ${roomCode} chưa có ảnh`}
        className="h-[264px] w-full rounded-2xl"
      />
    );
  }

  const thumbs = photos.slice(1, 1 + MAX_THUMBS);
  const hiddenCount = photos.length - 1 - thumbs.length;
  const open = (index: number) => setView({ kind: "viewer", index });

  return (
    <>
      <div
        className={`grid gap-2 ${
          thumbs.length > 0 ? "grid-cols-3 sm:grid-cols-[2fr_1fr_1fr_1fr]" : "grid-cols-1"
        }`}
      >
        <button
          type="button"
          onClick={() => open(0)}
          className="col-span-3 overflow-hidden rounded-xl sm:col-span-1 sm:row-span-2"
          aria-label="Xem ảnh lớn"
        >
          <RoomPhoto
            src={photos[0]}
            alt={`Ảnh chính phòng ${roomCode}`}
            className="h-[264px] w-full bg-slate-100 object-contain transition hover:opacity-95"
          />
        </button>
        {thumbs.map((src, i) => {
          const index = i + 1;
          const isLast = i === thumbs.length - 1 && hiddenCount > 0;
          return (
            <button
              type="button"
              key={index}
              onClick={() => (isLast ? setView({ kind: "album" }) : open(index))}
              className="relative overflow-hidden rounded-xl"
              aria-label={isLast ? `Xem tất cả ${photos.length} ảnh` : `Xem ảnh ${index + 1}`}
            >
              <RoomPhoto
                src={src}
                alt={`Ảnh phòng ${roomCode} ${index + 1}`}
                className="h-24 w-full bg-slate-100 object-contain transition hover:opacity-95 sm:h-32"
              />
              {isLast ? (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 px-1 text-center text-xs font-semibold text-white sm:text-sm">
                  <Images className="h-5 w-5" aria-hidden />
                  <span className="sm:hidden">+{hiddenCount + 1} ảnh</span>
                  <span className="hidden sm:inline">Xem tất cả {photos.length} ảnh</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {photos.length > 1 ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setView({ kind: "album" })}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-accent)] hover:underline"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Xem album ({photos.length} ảnh)
          </button>
        </div>
      ) : null}

      {view.kind !== "closed" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={view.kind === "album" ? "Album ảnh" : "Xem ảnh"}
          onClick={close}
        >
          <div
            className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white sm:h-[90vh] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              {view.kind === "viewer" ? (
                <button
                  type="button"
                  onClick={() => setView({ kind: "album" })}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-accent)] hover:underline"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Quay lại album
                </button>
              ) : (
                <h2 className="text-base font-semibold text-slate-900">
                  Album ảnh phòng {roomCode} ({photos.length})
                </h2>
              )}
              <button
                type="button"
                onClick={close}
                aria-label="Đóng"
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {view.kind === "album" ? (
              <div className="grid flex-1 auto-rows-[160px] grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((src, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => open(i)}
                    className="overflow-hidden rounded-lg"
                    aria-label={`Xem ảnh ${i + 1}`}
                  >
                    <RoomPhoto
                      src={src}
                      alt={`Ảnh phòng ${roomCode} ${i + 1}`}
                      className="h-full w-full bg-slate-100 object-contain transition hover:opacity-90"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col bg-slate-900">
                  <div className="relative flex min-h-[280px] flex-1 items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetUrl(photos[view.index])}
                      alt={`Ảnh phòng ${roomCode} ${view.index + 1}`}
                      className="max-h-full max-w-full object-contain"
                    />
                    {photos.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => go(-1)}
                          aria-label="Ảnh trước"
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow hover:bg-white"
                        >
                          <ChevronLeft className="h-5 w-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => go(1)}
                          aria-label="Ảnh sau"
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow hover:bg-white"
                        >
                          <ChevronRight className="h-5 w-5" aria-hidden />
                        </button>
                      </>
                    ) : null}
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                      {view.index + 1}/{photos.length}
                    </span>
                  </div>
                  {photos.length > 1 ? (
                    <div ref={stripRef} className="flex gap-2 overflow-x-auto bg-slate-950 p-2">
                      {photos.map((src, i) => (
                        <button
                          type="button"
                          key={i}
                          data-idx={i}
                          onClick={() => open(i)}
                          aria-label={`Ảnh ${i + 1}`}
                          aria-current={i === view.index}
                          className={`h-14 w-20 flex-none overflow-hidden rounded-md ring-2 transition ${
                            i === view.index ? "ring-white" : "ring-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          <RoomPhoto
                            src={src}
                            alt=""
                            className="h-full w-full bg-slate-800 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {sidePanel ? (
                  <aside className="w-full flex-none border-t border-slate-100 p-5 lg:w-[320px] lg:overflow-y-auto lg:border-l lg:border-t-0">
                    {sidePanel}
                  </aside>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
