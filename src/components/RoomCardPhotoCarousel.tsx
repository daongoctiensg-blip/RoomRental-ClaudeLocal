"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import RoomPhoto from "@/components/RoomPhoto";

/**
 * Homepage room card photo carousel — round 11 UI refresh, per owner
 * feedback (screenshots of a trip.com card with arrows + dot indicators
 * vs. our card's single static photo). Only takes over when a room has
 * more than 1 photo; a single-photo (or photo-less) room renders exactly
 * as before, no arrows/dots for nothing to cycle through. Deliberately
 * simple — no autoplay, no swipe gesture, just prev/next + dots, matching
 * what the owner actually asked to see.
 */
export default function RoomCardPhotoCarousel({
  photos,
  roomCode,
  className,
}: {
  photos: (string | undefined)[];
  roomCode: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  if (photos.length <= 1) {
    return <RoomPhoto src={photos[0]} alt={`Ảnh phòng ${roomCode}`} className={className} />;
  }

  const showPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i - 1 + photos.length) % photos.length);
  };
  const showNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + 1) % photos.length);
  };

  return (
    <div className="group relative h-full w-full overflow-hidden">
      <RoomPhoto src={photos[index]} alt={`Ảnh phòng ${roomCode} ${index + 1}`} className={className} />

      <button
        type="button"
        onClick={showPrev}
        aria-label="Ảnh trước"
        className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={showNext}
        aria-label="Ảnh sau"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>

      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
        {photos.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
}
