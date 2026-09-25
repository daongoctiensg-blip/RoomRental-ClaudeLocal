"use client";

import { useCallback, useEffect, useState } from "react";
import RoomPhoto from "@/components/RoomPhoto";
import { assetUrl } from "@/lib/basePath";

/**
 * Photo grid + lightbox — round 11. Same visual grid as before (1 big photo
 * + up to 4 thumbnails), but every photo is now clickable and opens a
 * full-screen viewer with prev/next navigation (arrow keys or on-screen
 * buttons) and Esc/backdrop-click to close. Photo-less rooms (RoomPhoto's
 * "Chưa có ảnh" placeholder) are not clickable — nothing to enlarge.
 */
export default function PhotoGallery({
  photos,
  roomCode,
}: {
  photos: (string | undefined)[];
  roomCode: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const hasAnyPhoto = photos.some(Boolean);

  const close = useCallback(() => setOpenIndex(null), []);
  const showPrev = useCallback(() => {
    setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);
  const showNext = useCallback(() => {
    setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") showPrev();
      else if (e.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, close, showPrev, showNext]);

  const openAt = (i: number) => {
    if (!photos[i]) return; // no photo there — nothing to show in the lightbox
    setOpenIndex(i);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => openAt(0)}
          disabled={!photos[0]}
          className="col-span-full sm:col-span-2 sm:row-span-2 disabled:cursor-default"
        >
          <RoomPhoto
            src={photos[0]}
            alt={`Ảnh chính phòng ${roomCode}`}
            className="h-[264px] w-full rounded-xl bg-slate-100 object-contain"
          />
        </button>
        {photos.slice(1, 5).map((src, i) => (
          <button
            type="button"
            key={i}
            onClick={() => openAt(i + 1)}
            disabled={!src}
            className="disabled:cursor-default"
          >
            <RoomPhoto
              src={src}
              alt={`Ảnh phòng ${roomCode} ${i + 2}`}
              className="h-32 w-full rounded-xl bg-slate-100 object-contain"
            />
          </button>
        ))}
      </div>

      {hasAnyPhoto && openIndex !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Đóng"
            className="absolute right-4 top-4 text-3xl text-white/80 hover:text-white"
          >
            ✕
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              showPrev();
            }}
            aria-label="Ảnh trước"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-2xl text-white hover:bg-white/20 sm:left-6"
          >
            ‹
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetUrl(photos[openIndex])}
            alt={`Ảnh phòng ${roomCode} ${openIndex + 1}`}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              showNext();
            }}
            aria-label="Ảnh sau"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-2xl text-white hover:bg-white/20 sm:right-6"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            {openIndex + 1}/{photos.length}
          </div>
        </div>
      ) : null}
    </>
  );
}
