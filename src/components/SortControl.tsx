"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { ROOM_SORT_OPTIONS } from "@/types";

export default function SortControl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get("sort") ?? "default";

  const setSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "default") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white">
      {ROOM_SORT_OPTIONS.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setSort(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium ${
            i > 0 ? "border-l border-slate-300" : ""
          } ${
            current === opt.value
              ? "bg-[color:var(--color-accent)] text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
