"use client";

import { useEffect, useRef, useState } from "react";

export type SearchableOption = { value: string; label: string };

/**
 * Type-to-filter dropdown. Plain <select> works fine for a handful of
 * options (status pills, price buckets) but is painful to use once a list
 * has hundreds/thousands of entries (the ward list alone has ~3,320) —
 * scrolling through them one screen at a time to find one by eye is slow.
 * This renders a text input; typing filters the option list live, clicking
 * a result commits it. Closing without picking a valid option reverts the
 * text back to whatever `value` currently is, so the field can never end
 * up holding free text that isn't actually one of `options`.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  wrapperClassName,
  maxResults = 200,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Visual styling for the text input itself (border, padding, focus ring). */
  className?: string;
  /** Layout/sizing for the outer wrapper (e.g. `sm:w-1/3`) — kept separate
   * from `className` because the wrapper, not the input, is the flex child
   * that actually needs the width/basis classes. Putting width utilities
   * only on the input left the unsized wrapper free to collapse to content
   * size, squeezing the whole search bar down to a sliver. */
  wrapperClassName?: string;
  /** Cap how many matches render at once — with 3,320 wards, rendering
   * every match on an empty/broad query would be slow and pointless since
   * the user is about to narrow it down by typing anyway. */
  maxResults?: number;
}) {
  const currentLabel = options.find((o) => o.value === value)?.label ?? "";
  const [query, setQuery] = useState(currentLabel);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the displayed text in sync when `value` changes from outside this
  // component (e.g. picking a different city clears the ward value/label).
  // Adjusted during render rather than in a useEffect — React's recommended
  // pattern for "reset state when a prop changes" (react.dev/learn/
  // you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes):
  // calling setState synchronously inside an effect body causes an extra,
  // visible render pass (the old query briefly flashes before the effect
  // catches up); comparing against a bit of state (not a ref — refs can't be
  // read/written during render) applies the reset in the same pass instead.
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setQuery(currentLabel);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(currentLabel); // revert any un-picked typed text
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLabel]);

  const trimmed = query.trim().toLowerCase();
  const filtered = (
    trimmed
      ? options.filter((o) => o.label.toLowerCase().includes(trimmed))
      : options
  ).slice(0, maxResults);

  return (
    <div ref={containerRef} className={`relative w-full ${wrapperClassName ?? ""}`}>
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        className={className}
      />
      {open && !disabled ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-300 bg-white text-sm shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-slate-400">Không tìm thấy — thử gõ ít chữ hơn</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value || "__empty__"}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setQuery(o.label);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left hover:bg-slate-100 ${
                  o.value === value ? "bg-slate-50 font-medium text-[color:var(--color-accent-dark)]" : ""
                }`}
              >
                {o.label}
              </button>
            ))
          )}
          {trimmed && filtered.length === maxResults ? (
            <div className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-400">
              Gõ thêm để lọc bớt kết quả…
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
