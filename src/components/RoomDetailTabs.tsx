"use client";

import { useState } from "react";
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
} from "lucide-react";
import Fact from "@/components/Fact";
import AmenityGrid from "@/components/AmenityGrid";
import { formatVnd } from "@/lib/format";
import type { Property, PublicProperty, PublicRoom, RoomWithProperty, UtilityFeeVersion } from "@/types";

const TABS = [
  { key: "overview", label: "Tổng quan", icon: Info },
  { key: "amenities", label: "Tiện nghi & Dịch vụ", icon: ListChecks },
  { key: "policy", label: "Chính sách", icon: Wallet },
  { key: "location", label: "Vị trí", icon: MapPin },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Tabbed layout for the customer-facing part of the room detail page —
 * round 11 UI refresh, replacing 4 stacked sections (which the owner
 * found "chiếm chỗ vừa xấu" — takes up too much space, scrolls forever)
 * with a trip.com-style tab bar. Scoped down from trip.com's own 6 tabs
 * to the 4 that have real data on this site (no "Đánh Giá Của Khách" —
 * no review data; no "Phòng" room-type picker — this page is already one
 * specific room, not a hotel with several room types to choose between).
 * Client-side only (no page reload between tabs). The admin-only "Nội bộ
 * (Sale)" panel lives in the sidebar in page.tsx, outside this component
 * entirely — untouched by this refresh, per the owner's explicit "không
 * đụng trang admin" scope answer.
 */
export default function RoomDetailTabs({
  room,
  property,
  amenities,
  fee,
}: {
  room: PublicRoom | RoomWithProperty;
  property: Property | PublicProperty;
  amenities: string[];
  fee: UtilityFeeVersion | undefined;
}) {
  const [active, setActive] = useState<TabKey>("overview");

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 pt-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
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
      </div>

      <div className="p-5">
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
              <p className="mt-4 text-sm text-slate-600">{room.description}</p>
            ) : null}
            {room.subUnits && room.subUnits.length > 0 ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
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

        {active === "amenities" ? <AmenityGrid amenities={amenities} /> : null}

        {active === "policy" ? (
          <div>
            {fee ? (
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <Fact icon={Zap} label="Điện" value={`${formatVnd(fee.electricityPricePerKwh)}/kWh`} />
                <Fact
                  icon={Droplets}
                  label="Nước"
                  value={`${formatVnd(fee.waterPricePerPerson)}/${fee.waterFeeMode === "per_m3" ? "m³" : "người"}`}
                />
                <Fact icon={Receipt} label="Phí dịch vụ" value={`${formatVnd(fee.serviceFeePerMonth)}/tháng`} />
              </dl>
            ) : null}
            <dl className={`grid grid-cols-1 gap-4 text-sm sm:grid-cols-3 ${fee ? "mt-4 border-t border-slate-100 pt-4" : ""}`}>
              <Fact
                label="Cọc giữ phòng"
                value={`${formatVnd(property.depositPolicy.holdAmount)} (giữ ${property.depositPolicy.holdDays} ngày)`}
              />
              <Fact
                label="Cọc khi ký hợp đồng"
                value={`${property.depositPolicy.securityDepositMonths} tháng tiền thuê`}
              />
              <Fact
                label="Thanh toán trước khi ký"
                value={`${property.depositPolicy.prepaidRentMonths} tháng tiền thuê`}
              />
            </dl>
            {property.depositPolicy.customerNote ? (
              <p className="mt-3 text-xs text-slate-400">{property.depositPolicy.customerNote}</p>
            ) : null}
          </div>
        ) : null}

        {active === "location" ? (
          <div>
            <p className="text-sm text-slate-600">{property.addressNew}</p>
            {property.addressOld ? (
              <p className="text-xs text-slate-400">(Địa chỉ cũ: {property.addressOld})</p>
            ) : null}
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {property.transportNotes.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
