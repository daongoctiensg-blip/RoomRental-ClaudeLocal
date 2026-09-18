// Domain types — mirrors the schema in the PRD (room-rental-platform-requirements.md).
// Keep this file as the single source of truth for shapes shared between the JSON-file
// data layer (src/lib/db.ts) and a future real-database implementation: as long as a new
// backend returns data matching these types, nothing else in the app needs to change.

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

export interface DepositPolicy {
  /** VND amount to hold a room before signing (đặt cọc giữ chỗ) */
  depositAmount: number;
  /** number of days the hold is kept before it's released if the tenant doesn't return */
  holdDays: number;
  /** free-text explanation of forfeiture rules */
  forfeitureRule: string;
  /** how many months of rent is required as a security deposit at contract signing */
  contractDepositMonths: number;
}

export interface CommissionTier {
  contractDurationMonths: number;
  commissionPercent: number;
}

export interface Promotion {
  description: string;
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
  lat?: number;
  lng?: number;
  contactPhone: string;
  amenitiesShared: string[];
  transportNotes: string[];
  utilityFeeVersions: UtilityFeeVersion[];
  depositPolicy: DepositPolicy;
  commissionPolicy: CommissionTier[];
  promotion?: Promotion;
  images: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubUnit {
  label: string;
  priceMonthly?: number;
  notes?: string;
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
  subUnits?: SubUnit[];
  amenitiesOverride?: string[];
  images: string[];
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  properties: Property[];
  rooms: Room[];
}

/** Query params accepted by GET /api/rooms and the public listing page. */
export interface RoomFilter {
  propertyId?: string;
  /** free text matched against property addressNew / addressOld */
  address?: string;
  status?: RoomStatus[];
  priceMin?: number;
  priceMax?: number;
}

/** A Room enriched with its parent Property — what the UI actually renders. */
export interface RoomWithProperty extends Room {
  property: Property;
}
