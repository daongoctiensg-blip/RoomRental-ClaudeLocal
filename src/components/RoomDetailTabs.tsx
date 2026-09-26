"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Info,
  MapPin,
  Wallet,
  ListChecks,
  Maximize2,
  DoorOpen,
  Tag,
  Users,
  Eye,
  Zap,
  Droplets,
  Receipt,
  Phone,
  X,
  ChevronRight,
} from "lucide-react";
import Fact from "@/components/Fact";
import AmenityGrid from "@/components/AmenityGrid";
import { AmenityIcon } from "@/components/AmenityIcon";
import { formatVnd, telHref } from "@/lib/format";
import type { AmenityGroupDisplay, DisplayAmenity } from "@/lib/amenities";
import type { MoveInCost } from "@/lib/moveInCost";
import type { Property, PublicProperty, PublicRoom, RoomWithProperty, UtilityFeeVersion } from "@/types";

const TABS = [
  { key: "overview", label: "Tổng quan", icon: Info },
  { key: "amenities", label: "Tiện nghi & Dịch vụ", icon: ListChecks },
  { key: "policy", label: "Chính sách", icon: Wallet },
  { key: "location", label: "Vị trí", icon: MapPin },
] as const;

export type RoomTabKey = (typeof TABS)[number]["key"];
const TAB_EVENT = "room-detail-tab";
const OVERVIEW_HIGHLIGHT_LIMIT = 8;

/** Lets anything else on the page (e.g. the price card's "Xem chi tiết chi
 * phí") switch this component's tab without prop-drilling state. */
export function RoomTabLink({
  tab,
  children,
  className,
}: {
  tab: RoomTabKey;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(TAB_EVENT, { detail: tab }))}
      className={className}
    >
      {children}
    </button>
  );
}

/**
 * Room detail page body — round 12 trip.com-style refresh of round 11's
 * tabbed layout (4 tabs kept, as agreed with the owner: content switches in
 * place so the page stays short, instead of trip.com's one long scrolling
 * page). New in round 12:
 *   - the tab bar is full-width and sticks to the top while scrolling; once
 *     the hero photos have scrolled away it also shows a compact price +
 *     "Gọi ngay" button (trip.com's sticky header price);
 *   - "Tổng quan" shows icon highlights + "Xem tất cả N tiện nghi", which
 *     opens a slide-over drawer with the full grouped amenity list;
 *   - "Chính sách" adds the "Chi phí nhận phòng dự kiến" breakdown.
 * The right-hand sidebar (price card, and for admins the "Nội bộ (Sale)"
 * panel) is rendered on the server and passed in as `sidebar` — this
 * component only positions it, it never sees or decides what's in it.
 */
export default function RoomDetailTabs({
  room,
  property,
  fee,
  amenityGroups,
  highlights,
  moveIn,
  sidebar,
}: {
  room: PublicRoom | RoomWithProperty;
  property: Property | PublicProperty;
  fee: UtilityFeeVersion | undefined;
  amenityGroups: AmenityGroupDisplay[];
  highlights: DisplayAmenity[];
  moveIn: MoveInCost;
  sidebar: React.ReactNode;
}) {
  const [active, setActive] = useState<RoomTabKey>("overview");
  const [stuck, setStuck] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const amenityCount = amenityGroups.reduce((n, g) => n + g.items.length, 0);

  // Sticky-state detection: the zero-height sentinel sits right above the
  // tab bar; once it scrolls out of view, the bar is stuck to the top.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      threshold: 0,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const selectTab = useCallback((tab: RoomTabKey) => {
    setActive(tab);
    // If the visitor is scrolled far down, bring the new tab's content into
    // view instead of leaving them staring at the bottom of the old one.
    const el = sentinelRef.current;
    if (el && el.getBoundingClientRect().top < 0) {
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const onTab = (e: Event) => {
      const tab = (e as CustomEvent<RoomTabKey>).detail;
      if (TABS.some((t) => t.key === tab)) selectTab(tab);
    };
    window.addEventListener(TAB_EVENT, onTab);
    return () => window.removeEventListener(TAB_EVENT, onTab);
  }, [selectTab]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden />
      <div
        className={`sticky top-0 z-20 rounded-xl border border-slate-200 bg-white/95 px-2 backdrop-blur transition-shadow ${
          stuck ? "shadow-sm" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Thông tin phòng">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.key === active;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => selectTab(tab.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex flex-none items-center gap-1.5 whitespace-nowrap px-3.5 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-b-2 border-[color:var(--color-accent)] text-[color:var(--color-accent-dark)]"
                      : "border-b-2 border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {tab.label}
                </button>
              );
            })}
          </nav>
          {stuck ? (
            <div className="hidden flex-none items-center gap-3 sm:flex">
              <span className="text-lg font-bold text-[color:var(--color-accent-dark)]">
                {formatVnd(room.priceMonthly)}
                <span className="text-xs font-normal text-slate-500">/tháng</span>
              </span>
              <a
                href={telHref(property.contactPhone)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-accent)] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[color:var(--color-accent-dark)]"
              >
                <Phone className="h-4 w-4" aria-hidden />
                Gọi ngay
              </a>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          {active === "overview" ? (
            <div>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <Fact icon={Maximize2} label="Diện tích" value={`${room.areaSqm} m²`} />
                <Fact icon={DoorOpen} label="Ban công" value={room.hasBalcony ? "Có" : "Không"} />
                <Fact icon={Tag} label="Giá thuê" value={`${formatVnd(room.priceMonthly)}/tháng`} />
                {room.maxOccupancy ? (
                  <Fact icon={Users} label="Số người ở tối đa" value={`${room.maxOccupancy} người`} />
                ) : null}
                {room.viewCount > 0 ? (
                  <Fact icon={Eye} label="Lượt xem" value={`${room.viewCount}`} />
                ) : null}
              </dl>
              {room.description ? (
                <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{room.description}</p>
              ) : null}

              {highlights.length > 0 ? (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-800">Tiện nghi</h3>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm text-slate-700 sm:grid-cols-4">
                    {highlights.slice(0, OVERVIEW_HIGHLIGHT_LIMIT).map((a) => (
                      <li key={a.name} className="flex items-center gap-2">
                        <AmenityIcon icon={a.icon} className="h-4 w-4 flex-none text-slate-500" />
                        <span className="truncate">{a.name}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-accent)] hover:underline"
                  >
                    Xem tất cả {amenityCount} tiện nghi
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : null}

              {room.subUnits && room.subUnits.length > 0 ? (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">
                    Phòng gồm các khu riêng
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {room.subUnits.map((su, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>
                          {su.label}
                          {su.notes ? <span className="text-slate-400"> · {su.notes}</span> : null}
                        </span>
                        {su.priceMonthly ? (
                          <span className="font-medium">{formatVnd(su.priceMonthly)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {active === "amenities" ? <AmenityGrid groups={amenityGroups} /> : null}

          {active === "policy" ? (
            <div className="flex flex-col gap-5">
              {fee ? (
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-800">Chi phí hàng tháng</h3>
                  <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                    <Fact icon={Zap} label="Điện" value={`${formatVnd(fee.electricityPricePerKwh)}/kWh`} />
                    <Fact
                      icon={Droplets}
                      label="Nước"
                      value={`${formatVnd(fee.waterPricePerPerson)}/${fee.waterFeeMode === "per_m3" ? "m³" : "người"}`}
                    />
                    <Fact icon={Receipt} label="Phí dịch vụ" value={`${formatVnd(fee.serviceFeePerMonth)}/tháng`} />
                  </dl>
                </section>
              ) : null}
              <MoveInCostBreakdown moveIn={moveIn} />
              {property.depositPolicy.customerNote ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  {property.depositPolicy.customerNote}
                </p>
              ) : null}
            </div>
          ) : null}

          {active === "location" ? (
            <div>
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 flex-none text-slate-400" aria-hidden />
                {property.addressNew}
              </p>
              {property.addressOld ? (
                <p className="ml-6 text-xs text-slate-400">(Địa chỉ cũ: {property.addressOld})</p>
              ) : null}
              {property.transportNotes.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-10 text-sm text-slate-600">
                  {property.transportNotes.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-16 lg:self-start">{sidebar}</aside>
      </div>

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Tất cả tiện nghi"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Tiện nghi & Dịch vụ ({amenityCount})
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Đóng"
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <AmenityGrid groups={amenityGroups} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MoveInCostBreakdown({ moveIn }: { moveIn: MoveInCost }) {
  const row = "flex items-baseline justify-between gap-4 py-2";
  const sub = "block text-xs text-slate-400";
  const hasHold = moveIn.holdAmount > 0;
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Chi phí nhận phòng dự kiến</h3>
      <p className="mb-2 text-xs text-slate-500">
        Tính theo chính sách cọc của tòa nhà và giá thuê phòng này.
      </p>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4 text-sm">
        {hasHold ? (
          <div className={row}>
            <span className="text-slate-600">
              <span className="font-medium text-slate-800">Bước 1 · Cọc giữ chỗ</span>
              {moveIn.holdDays > 0 ? ` (giữ phòng ${moveIn.holdDays} ngày)` : ""}
              <span className={sub}>Được tính vào tiền cọc nhà khi ký hợp đồng</span>
            </span>
            <span className="font-medium text-slate-800">{formatVnd(moveIn.holdAmount)}</span>
          </div>
        ) : null}
        <div className={row}>
          <span className="text-slate-600">
            <span className="font-medium text-slate-800">
              {hasHold ? "Bước 2 · Bù thêm cho đủ cọc nhà" : "Bước 2 · Cọc nhà"}
            </span>
            <span className={sub}>
              Cọc nhà {moveIn.securityDepositMonths} tháng = {formatVnd(moveIn.securityDeposit)}
              {hasHold ? ` − đã giữ chỗ ${formatVnd(moveIn.holdAmount)}` : ""}
            </span>
          </span>
          <span className="font-medium text-slate-800">{formatVnd(moveIn.depositTopUp)}</span>
        </div>
        <div className={row}>
          <span className="text-slate-600">
            <span className="font-medium text-slate-800">Bước 3 · Tiền thuê trả trước</span> (
            {moveIn.prepaidRentMonths} tháng)
          </span>
          <span className="font-medium text-slate-800">{formatVnd(moveIn.prepaidRent)}</span>
        </div>
        {hasHold ? (
          <div className={row}>
            <span className="text-slate-600">Đóng thêm khi ký hợp đồng (bước 2 + 3)</span>
            <span className="font-medium text-slate-800">{formatVnd(moveIn.payAtSigning)}</span>
          </div>
        ) : null}
        <div className={`${row} font-semibold`}>
          <span className="text-slate-800">
            Tổng chi phí nhận phòng
            <span className={`${sub} font-normal`}>
              Gồm cọc nhà {formatVnd(moveIn.securityDeposit)} + tiền thuê trả trước{" "}
              {formatVnd(moveIn.prepaidRent)}
            </span>
          </span>
          <span className="text-lg text-[color:var(--color-accent-dark)]">
            {formatVnd(moveIn.totalMoveIn)}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Chưa gồm tiền điện, nước, phí dịch vụ hàng tháng. Số tiền chính xác sẽ được xác nhận khi ký
        hợp đồng.
      </p>
    </section>
  );
}
