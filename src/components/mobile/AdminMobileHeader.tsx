"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/amenities", label: "Danh mục tiện ích" },
  { href: "/admin/commissions", label: "Hoa hồng" },
  { href: "/", label: "Trang công khai", exact: true },
];

/** Admin header for < md — round 13 (Claude Design board "6 · Admin"):
 * title + "+ Phòng" + menu, then horizontally scrolling section chips. */
export default function AdminMobileHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-b border-[#e3e7ee] bg-white text-[#16233b] md:hidden">
      <div className="flex h-14 items-center gap-2 pl-4 pr-2">
        <Link href="/admin" className="flex-grow text-lg font-bold">
          Quản trị
        </Link>
        <Link
          href="/admin/rooms/new"
          className="flex h-10 items-center gap-1.5 rounded-[10px] bg-[#2f6fed] px-3.5 text-sm font-bold text-white!"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Phòng
        </Link>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center"
          >
            <Menu className="h-[22px] w-[22px]" aria-hidden />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-12 z-50 flex w-48 flex-col rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-black/10">
              <Link href="/admin/properties/new" onClick={() => setMenuOpen(false)} className="px-4 py-2.5">
                + Nhà mới
              </Link>
              <Link href="/admin/rooms/new" onClick={() => setMenuOpen(false)} className="px-4 py-2.5">
                + Phòng mới
              </Link>
              <div className="border-t border-slate-100 px-4 py-2.5">
                <LogoutButton className="text-sm font-medium text-rose-600" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <nav aria-label="Mục quản trị" className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none]">
        {NAV.map((n) => {
          const on = isActive(n.href, n.exact);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={`flex h-[34px] flex-none items-center rounded-full px-3 text-[13px] ${
                on ? "bg-[#16233b] font-bold text-white!" : "bg-[#f1f4f8] font-medium text-[#334155]!"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
