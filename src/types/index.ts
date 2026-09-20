// Domain types — the schema behind the JSON-file data layer (src/lib/db.ts).
// Keep this file as the single source of truth for shapes shared across the
// app: as long as a future real-database implementation returns data
// matching these types, nothing else needs to change.

export type RoomStatus = "available" | "deposited" | "sold" | "renovating";

export const ROOM_STATUSES: RoomStatus[] = [
  "available",
  "deposited",
  "sold",
  "renovating",
];

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  available: "Còn trống",
  deposited: "Đã cọc",
  sold: "Đã cho thuê",
  renovating: "Đang sửa chữa",
};

export interface UtilityFeeVersion {
  id: string;
  electricityPricePerKwh: number;
  waterPricePerPerson: number;
  serviceFeePerMonth: number;
  /** ISO date string (yyyy-mm-dd). The active version is the latest one with effectiveFrom <= today. */
  effectiveFrom: string;
}

// ---------------------------------------------------------------------------
// Deposit policy — 4 explicitly separate concepts (do not merge these back
// into one field, they are genuinely different amounts collected at
// different moments of the rental process):
//
// 1. holdAmount / holdDays  — a small, fixed hold-fee the customer pays just
//    to reserve the room while deciding. If they don't come back within
//    holdDays, they lose it entirely and the room reopens.
// 2. securityDepositMonths  — the refundable-at-end-of-lease security
//    deposit collected when the contract is actually signed, expressed as a
//    number of months of rent.
// 3. prepaidRentMonths      — how many months of rent must be prepaid
//    up-front at signing (separate from the security deposit above).
// ---------------------------------------------------------------------------
export interface DepositPolicy {
  /** VND, fixed amount to hold a room before the customer commits. */
  holdAmount: number;
  /** Number of days the hold is kept before it's released/forfeited. */
  holdDays: number;
  /** Security deposit collected at contract signing, in months of rent. */
  securityDepositMonths: number;
  /** Months of rent prepaid up-front at contract signing. */
  prepaidRentMonths: number;
  /** Short, customer-safe note shown publicly (e.g. "giữ 7 ngày nếu không quay lại mất cọc"). */
  customerNote?: string;
}

// Internal-only: how the hold-fee is split if the customer actively cancels
// *before* it expires on its own (see calculateCancellationSettlement in
// src/lib/db.ts for the exact formula). Never shown to customers.
export interface DepositCancellationPolicy {
  landlordSharePercent: number;
  saleSharePercent: number;
  note?: string;
}

// ASSUMPTION (flagged for the owner to confirm): commissionPercent is applied
// to ONE MONTH of the room's rent, not to the full contract value — e.g. a
// 7.5tr/month room with a 6-month contract at 50% commission pays out
// 3.75tr, not 50% of the full 6-month contract value. This matches how the
// original landlord flyer reads ("hoa hồng 50%" / "80%" would be absurdly
// large percentages of a full contract). If this assumption is wrong, only
// calculateCommission() in src/lib/db.ts needs to change.
export interface CommissionTier {
  contractDurationMonths: number;
  commissionPercent: number;
}

// Bonus the LANDLORD pays the SALE for closing a deal within a time window —
// this is what the flyer calls "lì xì". It is never shown to customers.
export interface SaleBonusPolicy {
  description: string;
  amount: number;
  /** ISO date string */
  validFrom: string;
  /** ISO date string */
  validTo: string;
}

export interface Property {
  id: string;
  name: string;
  addressNew: string;
  addressOld?: string;
  /** Thành phố/Tỉnh — structured (not free text) so the public "Thành phố"
   * filter dropdown can do an exact match, distinct from the free-text
   * search box (which does fuzzy keyword + nearby-radius matching instead —
   * see src/lib/search.ts / src/lib/geocode.ts). Should read as a component
   * of addressNew, e.g. "Thành phố Hồ Chí Minh". */
  city: string;
  /** Phường/Xã — same idea as `city`, for the "Phường/Xã" filter dropdown. */
  ward: string;
  lat?: number;
  lng?: number;
  /** Public number customers call/Zalo to arrange a viewing. */
  contactPhone: string;
  /** Internal only — landlord's own name, for the sale's reference. */
  landlordName?: string;
  /** Internal only — sale calls/Zalos this to check availability or notify of a visit. Never shown to customers. */
  landlordContactPhone?: string;
  landlordZalo?: string;
  amenitiesShared: string[];
  transportNotes: string[];
  utilityFeeVersions: UtilityFeeVersion[];
  depositPolicy: DepositPolicy;
  /** Internal only. */
  depositCancellationPolicy: DepositCancellationPolicy;
  /** Internal only. */
  commissionPolicy: CommissionTier[];
  /** Internal only ("lì xì"). */
  saleBonusPolicy?: SaleBonusPolicy;
  images: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Everything about a Property that is safe to send to an unauthenticated visitor. */
export type PublicProperty = Omit<
  Property,
  | "landlordName"
  | "landlordContactPhone"
  | "landlordZalo"
  | "depositCancellationPolicy"
  | "commissionPolicy"
  | "saleBonusPolicy"
>;

export interface SubUnit {
  label: string;
  priceMonthly?: number;
  notes?: string;
}

/** Snapshot taken the moment a room enters "deposited" status, so a later
 * change to the property's policy never rewrites the terms a customer
 * actually agreed to. */
export interface ActiveDeposit {
  depositedAt: string;
  holdAmount: number;
  holdDays: number;
}

export interface Room {
  id: string;
  propertyId: string;
  code: string;
  floor?: string;
  areaSqm: number;
  hasBalcony: boolean;
  priceMonthly: number;
  status: RoomStatus;
  statusUpdatedAt: string;
  /** Set only while status === "deposited"; cleared on cancel/expire/sign. */
  currentDeposit?: ActiveDeposit;
  subUnits?: SubUnit[];
  amenitiesOverride?: string[];
  images: string[];
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Everything about a Room (and its embedded property) safe to send publicly. */
export type PublicRoom = Omit<Room, "currentDeposit" | "propertyId"> & {
  property: PublicProperty;
};

export interface Database {
  properties: Property[];
  rooms: Room[];
  roomStatusEvents: RoomStatusEvent[];
  roomDocuments: RoomDocument[];
}

/** Query params accepted by GET /api/rooms and the public listing page. */
export interface RoomFilter {
  propertyId?: string;
  /** Exact-match dropdown filters (Property.city / Property.ward). When
   * either is set, rooms are simply listed for that city/ward — no
   * geocoding, no fuzzy matching. Independent from `address` below and can
   * be combined with it, but only `address` ever triggers the fuzzy
   * keyword/nearby-radius search. */
  city?: string;
  ward?: string;
  /** Free-text search box query — fuzzy keyword matching (src/lib/search.ts)
   * plus nearby-radius geocoding (src/lib/geocode.ts). This is the ONLY
   * filter that triggers geocoding; city/ward above never do. */
  address?: string;
  status?: RoomStatus[];
  priceMin?: number;
  priceMax?: number;
}

/** A Room enriched with its parent Property — what the admin UI renders. */
export interface RoomWithProperty extends Room {
  property: Property;
}

// ---------------------------------------------------------------------------
// Room status history — append-only audit log. Every status transition,
// whether a plain manual change, a deposit starting, a deposit being
// cancelled/expiring, or a contract being signed, gets one row here so an
// admin can always answer "when did this happen and what was the money
// outcome" for any room.
// ---------------------------------------------------------------------------

export type RoomStatusEventType =
  | "status_change"
  | "deposit_started"
  | "deposit_cancelled"
  | "deposit_expired"
  | "contract_signed";

export const ROOM_STATUS_EVENT_LABEL: Record<RoomStatusEventType, string> = {
  status_change: "Đổi trạng thái",
  deposit_started: "Nhận cọc giữ phòng",
  deposit_cancelled: "Khách huỷ cọc",
  deposit_expired: "Hết hạn giữ cọc (khách không quay lại)",
  contract_signed: "Chốt hợp đồng",
};

export interface CancellationSettlement {
  daysHeld: number;
  holdDays: number;
  holdAmount: number;
  dailyRate: number;
  /** Kept by the landlord as compensation for the days the room was held. */
  landlordCompensation: number;
  /** What's left of the hold amount after the compensation above. */
  remainder: number;
  landlordShareOfRemainder: number;
  saleShareOfRemainder: number;
  /** landlordCompensation + landlordShareOfRemainder */
  landlordTotal: number;
  /** === saleShareOfRemainder */
  saleTotal: number;
}

export interface ContractSettlement {
  contractDurationMonths: number;
  commissionPercent: number;
  commissionAmount: number;
  bonusApplicable: boolean;
  bonusAmount: number;
  /** Set only when the contract was signed straight from "deposited" status
   * (rather than "available") — the hold-fee snapshot that was in effect at
   * that moment, kept here purely for the audit trail so it's on record
   * what happened to that money (folded into the deal) rather than it
   * silently disappearing when currentDeposit gets cleared. */
  previousDeposit?: { holdAmount: number; holdDays: number; depositedAt: string };
}

export interface RoomStatusEvent {
  id: string;
  roomId: string;
  occurredAt: string;
  fromStatus: RoomStatus;
  toStatus: RoomStatus;
  type: RoomStatusEventType;
  note?: string;
  deposit?: { holdAmount: number; holdDays: number };
  cancellation?: CancellationSettlement;
  contract?: ContractSettlement;
}

// ---------------------------------------------------------------------------
// Documents — attached to a specific room (and implicitly to whichever deal
// was active on it at the time). Fixed set of types for now; add a new one
// here (+ its label) whenever a new paperwork category comes up.
// ---------------------------------------------------------------------------

export type DocumentType =
  | "deposit_confirmation"
  | "rental_contract"
  | "additional_fee_receipt"
  | "commission_payment_confirmation"
  | "contract_addendum";

export const DOCUMENT_TYPES: DocumentType[] = [
  "deposit_confirmation",
  "rental_contract",
  "additional_fee_receipt",
  "commission_payment_confirmation",
  "contract_addendum",
];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  deposit_confirmation: "Giấy xác nhận cọc",
  rental_contract: "Hợp đồng thuê phòng",
  additional_fee_receipt: "Phụ phí",
  commission_payment_confirmation: "Giấy xác nhận thanh toán hoa hồng cho sale",
  contract_addendum: "Phụ lục hợp đồng thuê phòng",
};

export interface RoomDocument {
  id: string;
  roomId: string;
  type: DocumentType;
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
  note?: string;
}
