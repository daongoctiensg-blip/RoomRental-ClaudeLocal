"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { apiUrl } from "@/lib/basePath";
import {
  AMENITY_GROUP_LABEL,
  type Amenity,
  cleanAmenityLabel,
  normalizeAmenityName,
} from "@/lib/amenities";
import { AmenityIcon } from "@/components/AmenityIcon";

/**
 * Amenity multi-select backed by the amenity catalog — round 12. Replaces
 * the old "one amenity per line" textarea on the property and room forms.
 *
 * Owner's rule: if the amenity an admin needs isn't in the list yet (e.g.
 * "Nhà không bị thấm nước"), they just type it and press Enter — it is added
 * to the catalog AND selected in one step. Matching is case/diacritics-
 * insensitive, so typing "may lanh" + Enter selects the existing "Máy lạnh"
 * instead of creating a duplicate (the server enforces the same rule).
 */
export default function AmenityPicker({
  value,
  onChange,
  placeholder = "Gõ để tìm, hoặc gõ tên mới rồi Enter để thêm…",
  hideNames = [],
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Catalog items not to suggest (e.g. amenities the room already inherits
   * from its building — round 12e). */
  hideNames?: string[];
}) {
  const [catalog, setCatalog] = useState<Amenity[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  // Whether the admin actively moved the highlight (arrow keys / hover). If
  // not, Enter on a name that isn't an exact catalog match CREATES it — the
  // owner's literal rule ("gõ xong Enter là thêm vào danh mục và chọn luôn")
  // — rather than silently picking a partial match like "Bàn ghế" for "Bàn".
  const [navigated, setNavigated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/amenities"))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { amenities: Amenity[] }) => {
        if (!cancelled) setCatalog(data.amenities);
      })
      .catch(() => {
        if (!cancelled) setError("Không tải được danh mục tiện ích — vẫn có thể gõ tên rồi Enter.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close the dropdown on an outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const lookup = useMemo(
    () => new Map(catalog.map((a) => [normalizeAmenityName(a.name), a])),
    [catalog]
  );
  const selectedKeys = useMemo(() => new Set(value.map(normalizeAmenityName)), [value]);
  const hiddenKeys = useMemo(() => new Set(hideNames.map(normalizeAmenityName)), [hideNames]);

  const qKey = normalizeAmenityName(query);
  const suggestions = useMemo(
    () =>
      catalog.filter(
        (a) =>
          !selectedKeys.has(normalizeAmenityName(a.name)) &&
          !hiddenKeys.has(normalizeAmenityName(a.name)) &&
          (!qKey || normalizeAmenityName(a.name).includes(qKey))
      ),
    [catalog, selectedKeys, hiddenKeys, qKey]
  );
  const exactMatch = qKey ? lookup.get(qKey) : undefined;
  const canCreate = qKey.length > 0 && !exactMatch;
  // Options = matching catalog items, then (if nothing matches exactly) a
  // "+ Thêm ..." row. Enter always acts on the highlighted row.
  const optionCount = suggestions.length + (canCreate ? 1 : 0);

  const add = (name: string) => {
    if (selectedKeys.has(normalizeAmenityName(name))) return;
    onChange([...value, name]);
  };

  const remove = (name: string) => {
    const key = normalizeAmenityName(name);
    onChange(value.filter((v) => normalizeAmenityName(v) !== key));
  };

  const createAndAdd = async (raw: string) => {
    const name = cleanAmenityLabel(raw);
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/amenities"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Không thêm được tiện ích mới.");
        return;
      }
      const amenity = data.amenity as Amenity;
      setCatalog((prev) =>
        prev.some((a) => a.id === amenity.id) ? prev : [...prev, amenity]
      );
      add(amenity.name);
    } catch {
      // Network hiccup: still select it — saving the form registers any new
      // name in the catalog server-side anyway (canonicalizeAmenityNames).
      add(name);
    } finally {
      setBusy(false);
    }
    setQuery("");
    setHighlight(0);
    setNavigated(false);
  };

  const choose = (index: number) => {
    if (index < suggestions.length) {
      add(suggestions[index].name);
      setQuery("");
      setHighlight(0);
    } else if (canCreate) {
      void createAndAdd(query);
    }
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Never let Enter submit the surrounding property/room form.
      e.preventDefault();
      if (busy) return;
      if (exactMatch) {
        add(exactMatch.name);
        setQuery("");
        setHighlight(0);
      } else if (navigated && optionCount > 0) {
        choose(Math.min(highlight, optionCount - 1));
      } else if (canCreate) {
        void createAndAdd(query);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setNavigated(true);
      setHighlight((h) => Math.min(h + 1, Math.max(optionCount - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setNavigated(true);
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-[color:var(--color-accent)] focus-within:ring-1 focus-within:ring-[color:var(--color-accent)]"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((name) => {
          const a = lookup.get(normalizeAmenityName(name));
          return (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-sm text-sky-800 ring-1 ring-sky-200"
            >
              <AmenityIcon icon={a?.icon} className="h-3.5 w-3.5" />
              {name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(name);
                }}
                aria-label={`Bỏ ${name}`}
                className="ml-0.5 rounded text-sky-500 hover:text-sky-900"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
            setNavigated(false);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label="Thêm tiện ích"
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={busy}
          className="min-w-[160px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none focus:ring-0"
        />
      </div>

      {open && optionCount > 0 ? (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {suggestions.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                onMouseEnter={() => {
                  setHighlight(i);
                  setNavigated(true);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
                  i === highlight ? "bg-slate-100" : ""
                }`}
              >
                <AmenityIcon icon={a.icon} className="h-4 w-4 text-slate-500" />
                <span className="flex-1">{a.name}</span>
                <span className="text-xs text-slate-400">{AMENITY_GROUP_LABEL[a.group]}</span>
              </button>
            </li>
          ))}
          {canCreate ? (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(suggestions.length)}
                onMouseEnter={() => setHighlight(suggestions.length)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-medium text-[color:var(--color-accent-dark)] ${
                  highlight === suggestions.length ? "bg-slate-100" : ""
                }`}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Thêm &quot;{cleanAmenityLabel(query)}&quot; vào danh mục (Enter)
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      <p className="mt-1 text-xs text-slate-500">
        {busy
          ? "Đang thêm vào danh mục…"
          : "Chưa có trong danh sách? Gõ tên rồi nhấn Enter — hệ thống tự thêm vào danh mục và chọn luôn."}
      </p>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
