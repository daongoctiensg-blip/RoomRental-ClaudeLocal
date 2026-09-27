"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import SaveRoomButton from "@/components/SaveRoomButton";

export const MOBILE_SECTIONS = [
  { id: "tong-quan", label: "Tổng quan" },
  { id: "tien-nghi", label: "Tiện nghi" },
  { id: "chinh-sach", label: "Chính sách" },
  { id: "vi-tri", label: "Vị trí" },
] as const;

// Stuck header (52px) + tab row (~45px) + a little air.
const OFFSET = 104;

/**
 * Mobile room detail: sticky anchor tabs with scroll-spy — round 13
 * (Claude Design boards "4" and "5"). Unlike desktop (tabs switch content
 * in place), the mobile page is one continuous scroll and the tabs jump to
 * each section. Once the tabs reach the top, a compact header with back,
 * room title and heart appears above them.
 */
export default function MobileDetailNav({
  roomId,
  title,
  subtitle,
}: {
  roomId: string;
  title: string;
  subtitle: string;
}) {
  const [active, setActive] = useState<string>(MOBILE_SECTIONS[0].id);
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    // The tabs stick 52px from the top; the compact header (fixed, so it
    // never pushes the page down) fills that gap from the same moment.
    const obs = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), {
      threshold: 0,
      rootMargin: "-52px 0px 0px 0px",
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string = MOBILE_SECTIONS[0].id;
      for (const s of MOBILE_SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= OFFSET + 8) current = s.id;
      }
      // At the very bottom the last section may never reach the top.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        const last = MOBILE_SECTIONS[MOBILE_SECTIONS.length - 1].id;
        if (document.getElementById(last)) current = last;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const jump = (e: React.MouseEvent, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - OFFSET, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <>
      <div ref={sentinelRef} aria-hidden />
      {stuck ? (
        <div className="fixed inset-x-0 top-0 z-40 flex h-[52px] items-center gap-1 bg-white px-2">
          <Link href="/" aria-label="Quay lại danh sách" className="flex h-11 w-11 items-center justify-center">
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </Link>
          <span className="flex min-w-0 flex-grow flex-col">
            <span className="truncate text-base font-bold">{title}</span>
            <span className="truncate text-[11px] text-[#5b6475]">{subtitle}</span>
          </span>
          <SaveRoomButton roomId={roomId} size="sm" />
          <span className="w-1.5" />
        </div>
      ) : null}
      <div
        className={`sticky top-[52px] z-30 bg-white ${
          stuck ? "shadow-[0_2px_8px_rgba(22,35,59,0.08)]" : "border-b border-[#e3e7ee]"
        }`}
      >
        <nav
          aria-label="Nhảy tới mục"
          className={`flex overflow-x-auto px-2 [scrollbar-width:none] border-t ${stuck ? "border-[#eef1f5]" : "border-transparent"}`}
        >
          {MOBILE_SECTIONS.map((s) => {
            const on = s.id === active;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => jump(e, s.id)}
                aria-current={on ? "location" : undefined}
                className={`flex-none border-b-[3px] px-2.5 pb-2.5 pt-3 text-sm ${
                  on
                    ? "border-[#2f6fed] font-bold text-[#1d4fbf]!"
                    : "border-transparent font-medium text-[#5b6475]!"
                }`}
              >
                {s.label}
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );
}
