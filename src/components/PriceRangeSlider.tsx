"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Confirmed by the owner: 20 triệu is the top of the range. The rightmost
// handle sitting at MAX means "20 triệu trở lên" (unbounded upper bound),
// matching the reference site's dual-slider behavior.
export const PRICE_SLIDER_MIN = 0;
export const PRICE_SLIDER_MAX = 20_000_000;
const STEP = 100_000;

function formatVnd(n: number): string {
  if (n <= 0) return "0đ";
  if (n % 1_000_000 === 0) return `${n / 1_000_000} triệu`;
  return `${(n / 1_000_000).toFixed(1)} triệu`;
}

interface Props {
  /** Current lower bound in VND (0 if unset). */
  min: number;
  /** Current upper bound in VND, or null for "no upper bound". */
  max: number | null;
  /** Called (debounced) once the customer stops dragging, with the new
   * range. `nextMax === null` means the upper handle is at PRICE_SLIDER_MAX
   * (unbounded). */
  onChange: (nextMin: number, nextMax: number | null) => void;
}

/**
 * Two-handle price-range slider, sitting alongside (not replacing) the fixed
 * price-bucket pills in <FilterBar> — both control the same priceMin/
 * priceMax URL state, so dragging the slider moves the active pill
 * highlight and vice versa. Auto-searches on drag, debounced so a fast drag
 * doesn't fire a router.push per pixel.
 *
 * Built from two overlapping native <input type="range"> elements rather
 * than a pointer-tracking custom widget — simpler, free keyboard/a11y
 * support, and the classic "two ranges stacked, top one only intercepts
 * clicks near its own thumb" CSS trick (see globals.css) keeps both handles
 * independently draggable even when they're close together.
 */
export default function PriceRangeSlider({ min, max, onChange }: Props) {
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max ?? PRICE_SLIDER_MAX);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);

  // Reflect external changes (a bucket pill clicked, browser back/forward)
  // into the slider's local handle positions — but only when the customer
  // isn't mid-drag, otherwise an in-flight debounce commit would fight the
  // drag and make the handle jump.
  useEffect(() => {
    if (draggingRef.current) return;
    setLocalMin(min);
    setLocalMax(max ?? PRICE_SLIDER_MAX);
  }, [min, max]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const commit = useCallback(
    (nextMin: number, nextMax: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(nextMin, nextMax >= PRICE_SLIDER_MAX ? null : nextMax);
      }, 400);
    },
    [onChange]
  );

  const handleMinChange = (raw: number) => {
    draggingRef.current = true;
    const next = Math.min(raw, localMax - STEP);
    setLocalMin(next);
    commit(next, localMax);
  };

  const handleMaxChange = (raw: number) => {
    draggingRef.current = true;
    const next = Math.max(raw, localMin + STEP);
    setLocalMax(next);
    commit(localMin, next);
  };

  const stopDragging = () => {
    draggingRef.current = false;
  };

  const minPct = ((localMin - PRICE_SLIDER_MIN) / (PRICE_SLIDER_MAX - PRICE_SLIDER_MIN)) * 100;
  const maxPct = ((localMax - PRICE_SLIDER_MIN) / (PRICE_SLIDER_MAX - PRICE_SLIDER_MIN)) * 100;

  return (
    <div className="mt-3">
      <div className="price-range-slider relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[color:var(--color-accent)]"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        <input
          type="range"
          min={PRICE_SLIDER_MIN}
          max={PRICE_SLIDER_MAX}
          step={STEP}
          value={localMin}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          onPointerUp={stopDragging}
          onKeyUp={stopDragging}
          aria-label="Giá tối thiểu"
          className="price-range-thumb absolute inset-x-0 top-1/2 h-1 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
        <input
          type="range"
          min={PRICE_SLIDER_MIN}
          max={PRICE_SLIDER_MAX}
          step={STEP}
          value={localMax}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          onPointerUp={stopDragging}
          onKeyUp={stopDragging}
          aria-label="Giá tối đa"
          className="price-range-thumb absolute inset-x-0 top-1/2 h-1 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
        <span>{formatVnd(localMin)}</span>
        <span>{localMax >= PRICE_SLIDER_MAX ? `${formatVnd(PRICE_SLIDER_MAX)}+` : formatVnd(localMax)}</span>
      </div>
    </div>
  );
}
