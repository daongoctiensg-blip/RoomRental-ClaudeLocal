import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { PoolConnection } from "mysql2/promise";
import type {
  CancellationSettlement,
  CommissionTier,
  ContractSettlement,
  DepositCancellationPolicy,
  DepositPolicy,
  DocumentType,
  Property,
  PublicProperty,
  PublicRoom,
  Room,
  RoomDocument,
  RoomFilter,
  RoomStatus,
  RoomStatusEvent,
  RoomWithProperty,
  UtilityFeeVersion,
} from "@/types";
import { getPool } from "@/lib/mysqlPool";
import { extractSearchKeywords, matchesKeywords } from "@/lib/search";
import { NEARBY_RADIUS_KM, geocodeAddress, haversineDistanceKm } from "@/lib/geocode";
import { canonicalizeAmenityNames } from "@/lib/amenityCatalog";

// ---------------------------------------------------------------------------
// MySQL-backed data layer. Every function here returns/accepts the exact
// same shapes as before (see src/types) — this file replaces the old
// JSON-file version, but nothing outside it (API routes, pages, components)
// needed to change. See scripts/schema.sql for the table definitions and
// scripts/migrate.ts to create them + seed initial data.
// ---------------------------------------------------------------------------

// Uploaded files (room photos, documents) still live on disk — moving the
// *data records* to a real database doesn't change how binary files are
// stored; see saveUploadedFile/readUploadedFile/saveDocumentFile/
// readDocumentFile below, unchanged from before.
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "room-rental-data")
  : path.join(process.cwd(), "data");

const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
export function saveUploadedFile(filename: string, bytes: Buffer): void {
  ensureUploadsDir();
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), bytes);
}
export function readUploadedFile(filename: string): Buffer | null {
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

const DOCUMENTS_DIR = path.join(DATA_DIR, "documents");
function ensureDocumentsDir(): void {
  if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}
export function saveDocumentFile(filename: string, bytes: Buffer): void {
  ensureDocumentsDir();
  fs.writeFileSync(path.join(DOCUMENTS_DIR, filename), bytes);
}
export function readDocumentFile(filename: string): Buffer | null {
  const filePath = path.join(DOCUMENTS_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

function nowIso(): string {
  return new Date().toISOString();
}

// ------------------------- row <-> TS type mapping -------------------------
function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProperty(row: any): Property {
  return {
    id: row.id,
    name: row.name,
    addressNew: row.address_new,
    addressOld: row.address_old ?? undefined,
    city: row.city,
    ward: row.ward,
    district: row.district,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    contactPhone: row.contact_phone,
    landlordName: row.landlord_name ?? undefined,
    landlordContactPhone: row.landlord_contact_phone ?? undefined,
    landlordZalo: row.landlord_zalo ?? undefined,
    amenitiesShared: parseJson(row.amenities_shared, []),
    transportNotes: parseJson(row.transport_notes, []),
    utilityFeeVersions: parseJson(row.utility_fee_versions, []),
    depositPolicy: parseJson(row.deposit_policy, {
      holdAmount: 0,
      holdDays: 0,
      securityDepositMonths: 0,
      prepaidRentMonths: 0,
    }),
    depositCancellationPolicy: parseJson(row.deposit_cancellation_policy, {
      landlordSharePercent: 50,
      saleSharePercent: 50,
    }),
    commissionPolicy: parseJson(row.commission_policy, []),
    saleBonusPolicy: row.sale_bonus_policy ? parseJson(row.sale_bonus_policy, undefined) : undefined,
    customerPromotion: row.customer_promotion ?? undefined,
    images: parseJson(row.images, []),
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRoom(row: any): Room {
  return {
    id: row.id,
    propertyId: row.property_id,
    code: row.code,
    floor: row.floor ?? undefined,
    areaSqm: Number(row.area_sqm),
    hasBalcony: !!row.has_balcony,
    priceMonthly: Number(row.price_monthly),
    maxOccupancy: row.max_occupancy === null || row.max_occupancy === undefined ? undefined : Number(row.max_occupancy),
    viewCount: Number(row.view_count ?? 0),
    status: row.status,
    statusUpdatedAt: row.status_updated_at,
    currentDeposit: row.current_deposit ? parseJson(row.current_deposit, undefined) : undefined,
    subUnits: row.sub_units ? parseJson(row.sub_units, undefined) : undefined,
    amenitiesOverride: row.amenities_override
      ? parseJson(row.amenities_override, undefined)
      : undefined,
    images: parseJson(row.images, []),
    description: row.description ?? undefined,
    internalNotes: row.internal_notes ?? undefined,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEvent(row: any): RoomStatusEvent {
  return {
    id: row.id,
    roomId: row.room_id,
    occurredAt: row.occurred_at,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    type: row.type,
    note: row.note ?? undefined,
    deposit: row.deposit ? parseJson(row.deposit, undefined) : undefined,
    cancellation: row.cancellation ? parseJson(row.cancellation, undefined) : undefined,
    contract: row.contract ? parseJson(row.contract, undefined) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDocument(row: any): RoomDocument {
  return {
    id: row.id,
    roomId: row.room_id,
    type: row.type,
    fileUrl: row.file_url,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
    note: row.note ?? undefined,
  };
}

async function recordEvent(
  conn: PoolConnection,
  event: Omit<RoomStatusEvent, "id" | "occurredAt"> & { occurredAt?: string }
): Promise<RoomStatusEvent> {
  const full: RoomStatusEvent = {
    id: `evt-${randomUUID()}`,
    occurredAt: event.occurredAt ?? nowIso(),
    ...event,
  };
  await conn.query(
    `INSERT INTO room_status_events
      (id, room_id, occurred_at, from_status, to_status, type, note, deposit, cancellation, contract)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      full.id,
      full.roomId,
      full.occurredAt,
      full.fromStatus,
      full.toStatus,
      full.type,
      full.note ?? null,
      full.deposit ? JSON.stringify(full.deposit) : null,
      full.cancellation ? JSON.stringify(full.cancellation) : null,
      full.contract ? JSON.stringify(full.contract) : null,
    ]
  );
  return full;
}

// ----------------------------- Properties -----------------------------

export async function listProperties(opts?: { includeInactive?: boolean }): Promise<Property[]> {
  const pool = getPool();
  const sql = opts?.includeInactive
    ? "SELECT * FROM properties ORDER BY created_at DESC"
    : "SELECT * FROM properties WHERE is_active = 1 ORDER BY created_at DESC";
  const [rows] = await pool.query(sql);
  return (rows as unknown[]).map(rowToProperty);
}

export async function getProperty(id: string): Promise<Property | undefined> {
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM properties WHERE id = ?", [id]);
  const arr = rows as unknown[];
  return arr.length ? rowToProperty(arr[0]) : undefined;
}

export type PropertyInput = Omit<Property, "id" | "createdAt" | "updatedAt">;

// Server-side range validation for every money/percentage field on a
// Property. HTML min/max attributes on PropertyForm.tsx are a UX hint only —
// they are NOT a security boundary, since any direct API call bypasses them.
// Found in QA: without this, a direct call to POST/PUT /api/properties could
// set a negative holdAmount, a >100% landlord/sale split, or a commission
// tier with an out-of-range percent, all of which feed real money
// calculations (cancellation settlement, commission payout).
function validatePropertyMoneyFields(input: {
  depositPolicy?: Partial<DepositPolicy>;
  depositCancellationPolicy?: Partial<DepositCancellationPolicy>;
  commissionPolicy?: CommissionTier[];
}): string | null {
  const dp = input.depositPolicy;
  if (dp) {
    if (typeof dp.holdAmount === "number" && dp.holdAmount < 0) {
      return "Cọc giữ phòng không được âm.";
    }
    if (typeof dp.holdDays === "number" && dp.holdDays < 1) {
      return "Thời hạn giữ cọc phải ít nhất 1 ngày.";
    }
    if (typeof dp.securityDepositMonths === "number" && dp.securityDepositMonths < 0) {
      return "Giá trị cọc khi ký hợp đồng không được âm.";
    }
    if (typeof dp.prepaidRentMonths === "number" && dp.prepaidRentMonths < 0) {
      return "Số tháng thanh toán trước không được âm.";
    }
  }

  const cp = input.depositCancellationPolicy;
  if (cp) {
    const { landlordSharePercent, saleSharePercent } = cp;
    for (const [label, value] of [
      ["Tỉ lệ chủ nhà", landlordSharePercent],
      ["Tỉ lệ sale", saleSharePercent],
    ] as const) {
      if (typeof value === "number" && (value < 0 || value > 100)) {
        return `${label} trong chính sách huỷ cọc phải trong khoảng 0-100%.`;
      }
    }
    // Found in QA: calculateCancellationSettlement() only ever uses
    // saleSharePercent and derives the landlord's share as the remainder
    // (100% - sale%), for correct rounding (see comment there). It never
    // reads landlordSharePercent at all. Before this check, the UI only
    // showed a soft warning ("nên bằng 100%") that was never enforced —
    // an admin could save landlord=70/sale=50, and the actual money paid
    // out would silently use landlord=50 (the true complement of sale),
    // disagreeing with the 70 shown everywhere in the admin/sale UI. This
    // makes the two fields a hard-required pair so what's displayed is
    // always what's actually paid.
    if (
      typeof landlordSharePercent === "number" &&
      typeof saleSharePercent === "number" &&
      Math.abs(landlordSharePercent + saleSharePercent - 100) > 0.01
    ) {
      return "Tỉ lệ chủ nhà và tỉ lệ sale trong chính sách huỷ cọc phải cộng lại đúng bằng 100%.";
    }
  }

  if (input.commissionPolicy) {
    if (input.commissionPolicy.length === 0) {
      return "Cần ít nhất 1 mốc hoa hồng — không thể lưu chính sách hoa hồng trống.";
    }
    for (const tier of input.commissionPolicy) {
      if (tier.commissionPercent < 0 || tier.commissionPercent > 100) {
        return `Mốc hoa hồng ${tier.contractDurationMonths} tháng có % ngoài khoảng 0-100.`;
      }
      if (tier.contractDurationMonths <= 0) {
        return `Mốc hoa hồng phải có thời hạn hợp đồng lớn hơn 0 tháng.`;
      }
    }
  }

  return null;
}

/** Auto-fills lat/lng from the address via geocodeAddress() when the caller
 * didn't supply coordinates explicitly. Best-effort — a geocoding miss just
 * leaves lat/lng unset, it never blocks creating/saving the property. This
 * is what lets the "nearby" radius search in listRooms work without the
 * admin ever having to type in coordinates by hand (addendum §6d).
 *
 * Found in QA (this pass): this function existed nowhere in the codebase at
 * all — createProperty/updateProperty never called geocodeAddress, so every
 * property created since the original MySQL port has lat/lng permanently
 * NULL unless entered by hand, silently making the nearby-radius search
 * (§6d) a no-op for it forever. Confirmed live: created a property with no
 * lat/lng in the payload, got back lat: undefined, lng: undefined. */
async function geocodeForPropertySave(
  addressNew: string,
  addressOld: string | undefined
): Promise<{ lat: number; lng: number } | null> {
  const query = addressOld ? `${addressNew}, ${addressOld}` : addressNew;
  return geocodeAddress(query);
}

export async function createProperty(
  input: PropertyInput
): Promise<Property | { error: string }> {
  const validationError = validatePropertyMoneyFields(input);
  if (validationError) return { error: validationError };

  const geocoded =
    input.lat == null || input.lng == null
      ? await geocodeForPropertySave(input.addressNew, input.addressOld)
      : null;

  const pool = getPool();
  const property: Property = {
    ...input,
    // Round 12: every amenity name is canonicalized against the amenity
    // catalog (and any new name is added to it) — see amenityCatalog.ts.
    amenitiesShared: await canonicalizeAmenityNames(input.amenitiesShared),
    lat: input.lat ?? geocoded?.lat,
    lng: input.lng ?? geocoded?.lng,
    id: `prop-${randomUUID()}`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await pool.query(
    `INSERT INTO properties
      (id, name, address_new, address_old, city, ward, district, lat, lng, contact_phone,
       landlord_name, landlord_contact_phone, landlord_zalo,
       amenities_shared, transport_notes, utility_fee_versions,
       deposit_policy, deposit_cancellation_policy, commission_policy,
       sale_bonus_policy, customer_promotion, images, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      property.id,
      property.name,
      property.addressNew,
      property.addressOld ?? null,
      property.city,
      property.ward,
      property.district,
      property.lat ?? null,
      property.lng ?? null,
      property.contactPhone,
      property.landlordName ?? null,
      property.landlordContactPhone ?? null,
      property.landlordZalo ?? null,
      JSON.stringify(property.amenitiesShared),
      JSON.stringify(property.transportNotes),
      JSON.stringify(property.utilityFeeVersions),
      JSON.stringify(property.depositPolicy),
      JSON.stringify(property.depositCancellationPolicy),
      JSON.stringify(property.commissionPolicy),
      property.saleBonusPolicy ? JSON.stringify(property.saleBonusPolicy) : null,
      property.customerPromotion ?? null,
      JSON.stringify(property.images),
      property.isActive ? 1 : 0,
      property.createdAt,
      property.updatedAt,
    ]
  );
  return property;
}

const PROPERTY_COLUMN_MAP: Record<string, string> = {
  name: "name",
  addressNew: "address_new",
  addressOld: "address_old",
  city: "city",
  ward: "ward",
  district: "district",
  lat: "lat",
  lng: "lng",
  contactPhone: "contact_phone",
  landlordName: "landlord_name",
  landlordContactPhone: "landlord_contact_phone",
  landlordZalo: "landlord_zalo",
  isActive: "is_active",
  customerPromotion: "customer_promotion",
};
const PROPERTY_JSON_COLUMN_MAP: Record<string, string> = {
  amenitiesShared: "amenities_shared",
  transportNotes: "transport_notes",
  utilityFeeVersions: "utility_fee_versions",
  depositPolicy: "deposit_policy",
  depositCancellationPolicy: "deposit_cancellation_policy",
  commissionPolicy: "commission_policy",
  saleBonusPolicy: "sale_bonus_policy",
  images: "images",
};

export async function updateProperty(
  id: string,
  input: Partial<PropertyInput>
): Promise<Property | { error: string } | undefined> {
  // Found in QA (this pass): depositPolicy/depositCancellationPolicy/
  // saleBonusPolicy are each stored as ONE JSON column, and this function
  // used to write whatever partial object the caller sent as the WHOLE
  // column value — so e.g. PUT {depositCancellationPolicy:
  // {landlordSharePercent: 70}} (missing saleSharePercent) silently wiped
  // saleSharePercent from storage entirely. That bypassed the sum-to-100
  // check (which only fires when BOTH fields are present as numbers in the
  // same request) and broke real money math downstream:
  // calculateCancellationSettlement() ended up doing arithmetic against
  // `undefined`, and landlordShareOfRemainder/saleShareOfRemainder/
  // landlordTotal/saleTotal all came back NaN (serialized as `null` in the
  // JSON response) on the very next cancellation. Confirmed live: sent that
  // partial payload, then ran a real deposit+cancel and got exactly that —
  // all four fields null instead of numbers.
  //
  // Fix: merge each partial policy object onto the EXISTING stored one
  // before validating/saving, so the column can never end up missing a
  // sibling field no matter how the caller shapes the request — the same
  // "don't trust the caller's shape" principle finding #1 (money-field
  // validation) already established for this file.
  const existingForMerge =
    input.depositPolicy || input.depositCancellationPolicy || input.saleBonusPolicy
      ? await getProperty(id)
      : undefined;

  const mergedInput: Partial<PropertyInput> = { ...input };
  if (input.depositPolicy && existingForMerge) {
    mergedInput.depositPolicy = { ...existingForMerge.depositPolicy, ...input.depositPolicy };
  }
  if (input.depositCancellationPolicy && existingForMerge) {
    mergedInput.depositCancellationPolicy = {
      ...existingForMerge.depositCancellationPolicy,
      ...input.depositCancellationPolicy,
    };
  }
  if (input.saleBonusPolicy && existingForMerge) {
    mergedInput.saleBonusPolicy = {
      ...existingForMerge.saleBonusPolicy,
      ...input.saleBonusPolicy,
    };
  }

  if ("amenitiesShared" in mergedInput) {
    mergedInput.amenitiesShared = await canonicalizeAmenityNames(mergedInput.amenitiesShared);
  }

  const validationError = validatePropertyMoneyFields(mergedInput);
  if (validationError) return { error: validationError };

  // Only re-geocode when the address actually changed and the caller didn't
  // pass explicit coordinates — avoids an outbound call on every unrelated
  // edit (price change, photo swap, etc). Reuses existingForMerge when
  // already fetched above; otherwise fetches fresh just for this check.
  let geocoded: { lat: number; lng: number } | null = null;
  if (input.addressNew !== undefined && input.lat === undefined && input.lng === undefined) {
    const existing = existingForMerge ?? (await getProperty(id));
    if (existing && existing.addressNew !== input.addressNew) {
      geocoded = await geocodeForPropertySave(
        input.addressNew,
        input.addressOld ?? existing.addressOld
      );
    }
  }

  const pool = getPool();
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(PROPERTY_COLUMN_MAP)) {
    if (key in mergedInput) {
      const v = (mergedInput as Record<string, unknown>)[key];
      sets.push(`${column} = ?`);
      values.push(key === "isActive" ? (v ? 1 : 0) : v ?? null);
    }
  }
  for (const [key, column] of Object.entries(PROPERTY_JSON_COLUMN_MAP)) {
    if (key in mergedInput) {
      const v = (mergedInput as Record<string, unknown>)[key];
      sets.push(`${column} = ?`);
      values.push(v === undefined ? null : JSON.stringify(v));
    }
  }
  if (geocoded) {
    sets.push("lat = ?", "lng = ?");
    values.push(geocoded.lat, geocoded.lng);
  }
  if (sets.length === 0) return getProperty(id);

  sets.push("updated_at = ?");
  values.push(nowIso());
  values.push(id);

  const [result] = await pool.query(
    `UPDATE properties SET ${sets.join(", ")} WHERE id = ?`,
    values
  );
  if ((result as { affectedRows: number }).affectedRows === 0) return undefined;
  return getProperty(id);
}

/** Soft-delete: keeps history, just hides it from the public site. */
export async function deactivateProperty(id: string): Promise<boolean> {
  const pool = getPool();
  const [result] = await pool.query(
    "UPDATE properties SET is_active = 0, updated_at = ? WHERE id = ?",
    [nowIso(), id]
  );
  return (result as { affectedRows: number }).affectedRows > 0;
}

/** Append a new utility fee version. Never mutates/overwrites a past version. */
export async function addUtilityFeeVersion(
  propertyId: string,
  version: Omit<UtilityFeeVersion, "id">
): Promise<Property | undefined> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT utility_fee_versions FROM properties WHERE id = ? FOR UPDATE",
      [propertyId]
    );
    const arr = rows as unknown[];
    if (!arr.length) {
      await conn.rollback();
      return undefined;
    }
    const current: UtilityFeeVersion[] = parseJson(
      (arr[0] as { utility_fee_versions: unknown }).utility_fee_versions,
      []
    );
    const next = [...current, { ...version, id: `fee-${randomUUID()}` }];
    await conn.query(
      "UPDATE properties SET utility_fee_versions = ?, updated_at = ? WHERE id = ?",
      [JSON.stringify(next), nowIso(), propertyId]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return getProperty(propertyId);
}

export function getCurrentUtilityFee(
  property: Pick<Property, "utilityFeeVersions">
): UtilityFeeVersion | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return [...property.utilityFeeVersions]
    .filter((v) => v.effectiveFrom <= today)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
}

// --------------------- Public (customer-safe) shapes ---------------------
// Unchanged — pure functions, no DB involved.

export function toPublicProperty(property: Property): PublicProperty {
  const {
    landlordName: _landlordName,
    landlordContactPhone: _landlordContactPhone,
    landlordZalo: _landlordZalo,
    depositCancellationPolicy: _depositCancellationPolicy,
    commissionPolicy: _commissionPolicy,
    saleBonusPolicy: _saleBonusPolicy,
    ...rest
  } = property;
  return rest;
}

export function toPublicRoom(room: RoomWithProperty): PublicRoom {
  const {
    currentDeposit: _currentDeposit,
    propertyId: _propertyId,
    internalNotes: _internalNotes,
    property,
    ...rest
  } = room;
  return { ...rest, property: toPublicProperty(property) };
}

// ------------------------------- Rooms ---------------------------------

export type RoomInput = Omit<
  Room,
  "id" | "createdAt" | "updatedAt" | "statusUpdatedAt" | "currentDeposit"
>;

/** Auto-expire any "deposited" room whose hold period has run out, reverting
 * it to "available" and logging a deposit_expired event. Runs as part of
 * every read so the public site is never more than one request stale. Locks
 * each candidate row (FOR UPDATE) while it decides, so two simultaneous
 * requests can't both sweep (and double-log) the same expired room. */
async function sweepExpiredDeposits(conn: PoolConnection, now: Date): Promise<void> {
  const [rows] = await conn.query(
    "SELECT id, status, current_deposit FROM rooms WHERE status = 'deposited' AND current_deposit IS NOT NULL FOR UPDATE"
  );
  for (const row of rows as { id: string; current_deposit: unknown }[]) {
    const deposit = parseJson<{ depositedAt: string; holdDays: number } | null>(
      row.current_deposit,
      null
    );
    if (!deposit) continue;
    const deadline = new Date(deposit.depositedAt).getTime() + deposit.holdDays * 24 * 60 * 60 * 1000;
    if (now.getTime() < deadline) continue;

    const nowStr = now.toISOString();
    await conn.query(
      "UPDATE rooms SET status = 'available', status_updated_at = ?, updated_at = ?, current_deposit = NULL WHERE id = ?",
      [nowStr, nowStr, row.id]
    );
    await recordEvent(conn, {
      roomId: row.id,
      fromStatus: "deposited",
      toStatus: "available",
      type: "deposit_expired",
      occurredAt: nowStr,
      note: "Khách không quay lại trong thời hạn giữ cọc — chủ nhà giữ toàn bộ tiền giữ chỗ.",
    });
  }
}

export async function listRooms(
  filter?: RoomFilter,
  opts?: {
    /** Admin views (dashboard, commission report) need rooms that belong to
     * a deactivated ("unlisted") property to still show up — deactivating a
     * property hides it from the public site, it's not a delete. Found in
     * QA: without this, an unlisted property's rooms silently vanished from
     * every admin list and its past transactions in the commission report
     * got mislabeled "(phòng đã xoá)" even though nothing was deleted. The
     * public site must never pass this — default (false) is correct there. */
    includeInactiveProperties?: boolean;
  }
): Promise<RoomWithProperty[]> {
  const pool = getPool();
  const conn = await pool.getConnection();
  let rows;
  try {
    await conn.beginTransaction();
    await sweepExpiredDeposits(conn, new Date());
    await conn.commit();

    const clauses: string[] = ["r.is_active = 1"];
    if (!opts?.includeInactiveProperties) {
      clauses.push("p.is_active = 1");
    }
    const values: unknown[] = [];

    if (filter?.propertyId) {
      clauses.push("r.property_id = ?");
      values.push(filter.propertyId);
    }
    if (filter?.status && filter.status.length > 0) {
      clauses.push(`r.status IN (${filter.status.map(() => "?").join(",")})`);
      values.push(...filter.status);
    }
    if (typeof filter?.priceMin === "number") {
      clauses.push("r.price_monthly >= ?");
      values.push(filter.priceMin);
    }
    if (typeof filter?.priceMax === "number") {
      clauses.push("r.price_monthly < ?");
      values.push(filter.priceMax);
    }
    // "Số người ở" filter — 1/2 are exact matches, 3 means "3 or more"
    // (matches the 3-4 người bucket in the UI). Rooms with no maxOccupancy
    // set are excluded once this filter is active, since we can't tell
    // whether they'd match.
    if (filter?.occupancy === 1 || filter?.occupancy === 2) {
      clauses.push("r.max_occupancy = ?");
      values.push(filter.occupancy);
    } else if (filter?.occupancy === 3) {
      clauses.push("r.max_occupancy >= 3");
    }
    // Dropdown filters (exact match, no geocoding — the customer explicitly
    // picked a city/ward/district, so just list everything in it).
    // Independent from the free-text `address` search box below, which is
    // the only thing that triggers fuzzy keyword/nearby-radius matching.
    if (filter?.city) {
      clauses.push("LOWER(TRIM(p.city)) = ?");
      values.push(filter.city.trim().toLowerCase());
    }
    if (filter?.ward) {
      clauses.push("LOWER(TRIM(p.ward)) = ?");
      values.push(filter.ward.trim().toLowerCase());
    }
    if (filter?.district) {
      clauses.push("LOWER(TRIM(p.district)) = ?");
      values.push(filter.district.trim().toLowerCase());
    }

    // nestTables: true — rooms and properties share several column names
    // (id, images, is_active, created_at, updated_at). A flat `SELECT r.*,
    // p.*` collides those into one object and mysql2 silently keeps only the
    // LAST one of each duplicate key — found in QA: every room ended up with
    // the PROPERTY's images/is_active/created_at/updated_at instead of its
    // own, so every room card on the public site silently showed the
    // property's photo instead of that specific room's photo. nestTables
    // keeps each table's columns in its own `{r: {...}, p: {...}}` bucket,
    // so there's no collision regardless of how many columns happen to
    // share a name between the two tables.
    const orderBy =
      filter?.sortBy === "price_asc"
        ? "r.price_monthly ASC"
        : filter?.sortBy === "price_desc"
          ? "r.price_monthly DESC"
          : "r.created_at DESC"; // "default" and "newest" both read as newest-first at the SQL level

    [rows] = await conn.query(
      {
        sql: `SELECT r.*, p.*
       FROM rooms r JOIN properties p ON p.id = r.property_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY ${orderBy}`,
        nestTables: true,
      },
      values
    );
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  let withProperty: RoomWithProperty[] = (
    rows as { r: Record<string, unknown>; p: Record<string, unknown> }[]
  ).map((row) => {
    const room = rowToRoom(row.r);
    const property = rowToProperty(row.p);
    return { ...room, property };
  });

  if (filter?.address) {
    // Free-text location search combines two independent signals, either of
    // which is enough to include a room:
    //  1. Keyword match (src/lib/search.ts) — catches "quận 7", "Phú
    //     Thuận", etc. against our own address/transport-notes text.
    //  2. Radius match (src/lib/geocode.ts) — catches a street or landmark
    //     that isn't in our address text at all, by geocoding the query and
    //     the property and checking the straight-line distance.
    // This is done in JS (not SQL) because it needs Vietnamese-aware
    // keyword extraction and an outbound geocoding call — matches the exact
    // logic that ran against the JSON-file store, just against a SQL-fetched
    // dataset instead. Results are then sorted nearest-first when we have a
    // distance, keyword-only matches trailing after (still relevant, just
    // unranked).
    const keywords = extractSearchKeywords(filter.address);
    const queryPoint = await geocodeAddress(filter.address);

    const scored = withProperty.map((r) => {
      const matchesKeyword = matchesKeywords(
        [
          r.property.addressNew,
          r.property.addressOld ?? "",
          r.property.name,
          ...r.property.transportNotes,
        ].join(" | "),
        keywords
      );
      const distanceKm =
        queryPoint && typeof r.property.lat === "number" && typeof r.property.lng === "number"
          ? haversineDistanceKm(queryPoint, { lat: r.property.lat, lng: r.property.lng })
          : null;
      return { room: r, matchesKeyword, distanceKm };
    });

    const filtered = scored.filter(
      (s) => s.matchesKeyword || (s.distanceKm !== null && s.distanceKm <= NEARBY_RADIUS_KM)
    );

    filtered.sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return 0;
    });

    withProperty = filtered.map((s) => s.room);
  }

  return withProperty;
}

export async function getRoom(id: string): Promise<RoomWithProperty | undefined> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await sweepExpiredDeposits(conn, new Date());
    await conn.commit();

    const [rows] = await conn.query("SELECT * FROM rooms WHERE id = ?", [id]);
    const arr = rows as unknown[];
    if (!arr.length) return undefined;
    const room = rowToRoom(arr[0]);
    const property = await getProperty(room.propertyId);
    if (!property) return undefined;
    return { ...room, property };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Atomically increments a room's real view counter. Called once per open of
 * the public/admin room detail page (src/app/rooms/[id]/page.tsx), for every
 * viewer type — customer, sale, and admin all count. Deliberately separate
 * from getRoom() itself, since getRoom() is also called from non-detail-page
 * contexts (admin edit form load, API lookups, contract flows) where a view
 * should NOT be counted. Never touches other columns/updated_at, since a
 * view is not a content edit. */
export async function recordRoomView(id: string): Promise<void> {
  const pool = getPool();
  await pool.query("UPDATE rooms SET view_count = view_count + 1 WHERE id = ?", [id]);
}

export async function createRoom(input: RoomInput): Promise<Room> {
  const pool = getPool();
  // Round 12: an empty override means "use the property's amenities" —
  // stored as NULL, never as an empty list (which would read as "this room
  // has no amenities at all").
  const override = await canonicalizeAmenityNames(input.amenitiesOverride);
  const room: Room = {
    ...input,
    amenitiesOverride: override.length > 0 ? override : undefined,
    id: `room-${randomUUID()}`,
    // viewCount is a real counter, never caller-supplied — always starts at
    // 0 for a brand-new room regardless of what's in `input`.
    viewCount: 0,
    statusUpdatedAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await pool.query(
    `INSERT INTO rooms
      (id, property_id, code, floor, area_sqm, has_balcony, price_monthly,
       max_occupancy, view_count,
       status, status_updated_at, current_deposit, sub_units,
       amenities_override, images, description, internal_notes, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      room.id,
      room.propertyId,
      room.code,
      room.floor ?? null,
      room.areaSqm,
      room.hasBalcony ? 1 : 0,
      room.priceMonthly,
      room.maxOccupancy ?? null,
      room.viewCount,
      room.status,
      room.statusUpdatedAt,
      room.currentDeposit ? JSON.stringify(room.currentDeposit) : null,
      room.subUnits ? JSON.stringify(room.subUnits) : null,
      room.amenitiesOverride ? JSON.stringify(room.amenitiesOverride) : null,
      JSON.stringify(room.images),
      room.description ?? null,
      room.internalNotes ?? null,
      room.isActive ? 1 : 0,
      room.createdAt,
      room.updatedAt,
    ]
  );
  return room;
}

const ROOM_COLUMN_MAP: Record<string, string> = {
  propertyId: "property_id",
  code: "code",
  floor: "floor",
  areaSqm: "area_sqm",
  hasBalcony: "has_balcony",
  priceMonthly: "price_monthly",
  maxOccupancy: "max_occupancy",
  description: "description",
  internalNotes: "internal_notes",
  isActive: "is_active",
};
const ROOM_JSON_COLUMN_MAP: Record<string, string> = {
  subUnits: "sub_units",
  amenitiesOverride: "amenities_override",
  images: "images",
};

/** Generic edit for a room's own fields. Deliberately ignores `status` —
 * status changes for "deposited"/"sold" must go through startDeposit /
 * cancelDeposit / signContract so the money math and history log stay
 * correct; use setRoomStatus only for the simple available<->renovating
 * cases that don't carry any financial meaning. */
export async function updateRoom(
  id: string,
  input: Partial<Omit<RoomInput, "status">>
): Promise<Room | undefined> {
  const pool = getPool();
  const sets: string[] = [];
  const values: unknown[] = [];

  if ("amenitiesOverride" in input) {
    const override = await canonicalizeAmenityNames(input.amenitiesOverride);
    input = { ...input, amenitiesOverride: override.length > 0 ? override : undefined };
  }

  for (const [key, column] of Object.entries(ROOM_COLUMN_MAP)) {
    if (key in input) {
      const v = (input as Record<string, unknown>)[key];
      sets.push(`${column} = ?`);
      values.push(key === "hasBalcony" || key === "isActive" ? (v ? 1 : 0) : v ?? null);
    }
  }
  for (const [key, column] of Object.entries(ROOM_JSON_COLUMN_MAP)) {
    if (key in input) {
      const v = (input as Record<string, unknown>)[key];
      sets.push(`${column} = ?`);
      // null (sent by the edit form to clear a field) is stored as SQL NULL,
      // not as the JSON text "null".
      values.push(v === undefined || v === null ? null : JSON.stringify(v));
    }
  }
  if (sets.length === 0) {
    const [rows] = await pool.query("SELECT * FROM rooms WHERE id = ?", [id]);
    const arr = rows as unknown[];
    return arr.length ? rowToRoom(arr[0]) : undefined;
  }

  sets.push("updated_at = ?");
  values.push(nowIso());
  values.push(id);

  const [result] = await pool.query(`UPDATE rooms SET ${sets.join(", ")} WHERE id = ?`, values);
  if ((result as { affectedRows: number }).affectedRows === 0) return undefined;

  const [rows] = await pool.query("SELECT * FROM rooms WHERE id = ?", [id]);
  const arr = rows as unknown[];
  return arr.length ? rowToRoom(arr[0]) : undefined;
}

/** Plain manual status change, for transitions with no money attached
 * (e.g. available <-> renovating, or an admin correcting a mistake). Blocks
 * moving *into* "deposited" or "sold" — those need startDeposit/signContract
 * so the required snapshot/settlement data is captured. */
export async function setRoomStatus(
  id: string,
  status: RoomStatus
): Promise<Room | { error: string } | undefined> {
  if (status === "deposited" || status === "sold") {
    return {
      error:
        status === "deposited"
          ? "Dùng chức năng “Nhận cọc” để chuyển sang Đã cọc (cần lưu số tiền/ngày giữ)."
          : "Dùng chức năng “Chốt hợp đồng” để chuyển sang Đã cho thuê (cần chọn thời hạn hợp đồng để tính hoa hồng).",
    };
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM rooms WHERE id = ? FOR UPDATE", [id]);
    const arr = rows as unknown[];
    if (!arr.length) {
      await conn.rollback();
      return undefined;
    }
    const room = rowToRoom(arr[0]);
    const fromStatus = room.status;
    const now = nowIso();
    await conn.query(
      "UPDATE rooms SET status = ?, status_updated_at = ?, updated_at = ?, current_deposit = NULL WHERE id = ?",
      [status, now, now, id]
    );
    if (fromStatus !== status) {
      await recordEvent(conn, { roomId: id, fromStatus, toStatus: status, type: "status_change" });
    }
    await conn.commit();
    return { ...room, status, statusUpdatedAt: now, updatedAt: now, currentDeposit: undefined };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deactivateRoom(id: string): Promise<boolean> {
  const pool = getPool();
  const [result] = await pool.query(
    "UPDATE rooms SET is_active = 0, updated_at = ? WHERE id = ?",
    [nowIso(), id]
  );
  return (result as { affectedRows: number }).affectedRows > 0;
}

// --------------------------- Deposit lifecycle ---------------------------

export async function startDeposit(
  roomId: string
): Promise<Room | { error: string } | undefined> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [roomRows] = await conn.query("SELECT * FROM rooms WHERE id = ? FOR UPDATE", [roomId]);
    const roomArr = roomRows as unknown[];
    if (!roomArr.length) {
      await conn.rollback();
      return undefined;
    }
    const room = rowToRoom(roomArr[0]);
    if (room.status !== "available") {
      await conn.rollback();
      return { error: "Chỉ nhận cọc được cho phòng đang Còn trống." };
    }
    const property = await getProperty(room.propertyId);
    if (!property) {
      await conn.rollback();
      return { error: "Không tìm thấy nhà của phòng này." };
    }

    const depositedAt = nowIso();
    const currentDeposit = {
      depositedAt,
      holdAmount: property.depositPolicy.holdAmount,
      holdDays: property.depositPolicy.holdDays,
    };
    await conn.query(
      "UPDATE rooms SET status = 'deposited', status_updated_at = ?, updated_at = ?, current_deposit = ? WHERE id = ?",
      [depositedAt, depositedAt, JSON.stringify(currentDeposit), roomId]
    );
    await recordEvent(conn, {
      roomId,
      fromStatus: room.status,
      toStatus: "deposited",
      type: "deposit_started",
      occurredAt: depositedAt,
      deposit: { holdAmount: currentDeposit.holdAmount, holdDays: currentDeposit.holdDays },
    });
    await conn.commit();
    return { ...room, status: "deposited", statusUpdatedAt: depositedAt, updatedAt: depositedAt, currentDeposit };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** The exact worked example the owner gave:
 * hold 2,000,000đ for 5 days => 400,000đ/day. Customer backs out on day 4 =>
 * landlord keeps 400,000 × 4 = 1,600,000 as compensation for holding the
 * room; the remaining 400,000 is split 50/50 (200k sale / 200k landlord).
 * Pure function, unchanged from the JSON-file version — no DB involved. */
export function calculateCancellationSettlement(
  holdAmount: number,
  holdDays: number,
  depositedAt: string,
  occurredAt: Date,
  landlordSharePercent: number,
  saleSharePercent: number
): CancellationSettlement {
  const msPerDay = 24 * 60 * 60 * 1000;
  const rawDaysHeld = Math.floor(
    (occurredAt.getTime() - new Date(depositedAt).getTime()) / msPerDay
  );
  const daysHeld = Math.min(Math.max(rawDaysHeld, 0), holdDays);
  const dailyRate = holdDays > 0 ? holdAmount / holdDays : 0;
  const landlordCompensation = Math.round(dailyRate * daysHeld);
  const remainder = Math.max(holdAmount - landlordCompensation, 0);
  const saleShareOfRemainder = Math.round((remainder * saleSharePercent) / 100);
  const landlordShareOfRemainder = remainder - saleShareOfRemainder;

  return {
    daysHeld,
    holdDays,
    holdAmount,
    dailyRate,
    landlordCompensation,
    remainder,
    landlordShareOfRemainder,
    saleShareOfRemainder,
    landlordTotal: landlordCompensation + landlordShareOfRemainder,
    saleTotal: saleShareOfRemainder,
  };
}

export async function cancelDeposit(
  roomId: string
): Promise<{ room: Room; settlement: CancellationSettlement } | { error: string } | undefined> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [roomRows] = await conn.query("SELECT * FROM rooms WHERE id = ? FOR UPDATE", [roomId]);
    const roomArr = roomRows as unknown[];
    if (!roomArr.length) {
      await conn.rollback();
      return undefined;
    }
    const room = rowToRoom(roomArr[0]);
    if (room.status !== "deposited" || !room.currentDeposit) {
      await conn.rollback();
      return { error: "Phòng này hiện không ở trạng thái Đã cọc." };
    }
    const property = await getProperty(room.propertyId);
    if (!property) {
      await conn.rollback();
      return { error: "Không tìm thấy nhà của phòng này." };
    }

    const now = new Date();
    const settlement = calculateCancellationSettlement(
      room.currentDeposit.holdAmount,
      room.currentDeposit.holdDays,
      room.currentDeposit.depositedAt,
      now,
      property.depositCancellationPolicy.landlordSharePercent,
      property.depositCancellationPolicy.saleSharePercent
    );

    const nowStr = now.toISOString();
    await conn.query(
      "UPDATE rooms SET status = 'available', status_updated_at = ?, updated_at = ?, current_deposit = NULL WHERE id = ?",
      [nowStr, nowStr, roomId]
    );
    await recordEvent(conn, {
      roomId,
      fromStatus: room.status,
      toStatus: "available",
      type: "deposit_cancelled",
      occurredAt: nowStr,
      cancellation: settlement,
    });
    await conn.commit();
    return {
      room: { ...room, status: "available", statusUpdatedAt: nowStr, updatedAt: nowStr, currentDeposit: undefined },
      settlement,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// --------------------------- Contract / commission ---------------------------

/** Pure function, unchanged from the JSON-file version — no DB involved. */
// Found in QA: this used to silently return { commissionPercent: 0,
// commissionAmount: 0 } when the policy was empty or no tier matched the
// contract duration — a contract could be signed and recorded with zero
// commission with no indication anything was wrong. Now returns an explicit
// error instead, which signContract propagates.
export function calculateCommission(
  priceMonthly: number,
  contractDurationMonths: number,
  commissionPolicy: { contractDurationMonths: number; commissionPercent: number }[]
): { commissionPercent: number; commissionAmount: number } | { error: string } {
  if (commissionPolicy.length === 0) {
    return { error: "Nhà này chưa có chính sách hoa hồng — không thể chốt hợp đồng." };
  }
  const exact = commissionPolicy.find(
    (t) => t.contractDurationMonths === contractDurationMonths
  );
  const tier =
    exact ??
    [...commissionPolicy]
      .filter((t) => t.contractDurationMonths <= contractDurationMonths)
      .sort((a, b) => b.contractDurationMonths - a.contractDurationMonths)[0];

  if (!tier) {
    return {
      error: `Không có mốc hoa hồng nào áp dụng cho hợp đồng ${contractDurationMonths} tháng.`,
    };
  }

  const commissionAmount = Math.round((priceMonthly * tier.commissionPercent) / 100);
  return { commissionPercent: tier.commissionPercent, commissionAmount };
}

function isWithin(date: Date, fromIso: string, toIso: string): boolean {
  const d = date.toISOString().slice(0, 10);
  return d >= fromIso && d <= toIso;
}

export async function signContract(
  roomId: string,
  contractDurationMonths: number
): Promise<{ room: Room; settlement: ContractSettlement } | { error: string } | undefined> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [roomRows] = await conn.query("SELECT * FROM rooms WHERE id = ? FOR UPDATE", [roomId]);
    const roomArr = roomRows as unknown[];
    if (!roomArr.length) {
      await conn.rollback();
      return undefined;
    }
    const room = rowToRoom(roomArr[0]);
    if (room.status !== "available" && room.status !== "deposited") {
      await conn.rollback();
      return { error: "Chỉ chốt hợp đồng được từ trạng thái Còn trống hoặc Đã cọc." };
    }
    const property = await getProperty(room.propertyId);
    if (!property) {
      await conn.rollback();
      return { error: "Không tìm thấy nhà của phòng này." };
    }

    const now = new Date();
    const commission = calculateCommission(
      room.priceMonthly,
      contractDurationMonths,
      property.commissionPolicy
    );
    if ("error" in commission) {
      await conn.rollback();
      return commission;
    }
    const { commissionPercent, commissionAmount } = commission;
    const bonus = property.saleBonusPolicy;
    const bonusApplicable = !!bonus && isWithin(now, bonus.validFrom, bonus.validTo);
    const bonusAmount = bonusApplicable ? bonus!.amount : 0;

    // Audit-trail snapshot: capture the deposit terms in effect right before
    // they're cleared below, so there's a record of what was agreed even
    // after currentDeposit is wiped by this same transaction (finding #5 —
    // previously this info silently disappeared once a contract was signed
    // straight from "deposited" status).
    const previousDeposit = room.currentDeposit
      ? {
          holdAmount: room.currentDeposit.holdAmount,
          holdDays: room.currentDeposit.holdDays,
          depositedAt: room.currentDeposit.depositedAt,
        }
      : undefined;

    const settlement: ContractSettlement = {
      contractDurationMonths,
      commissionPercent,
      commissionAmount,
      bonusApplicable,
      bonusAmount,
      previousDeposit,
    };

    const nowStr = now.toISOString();
    await conn.query(
      "UPDATE rooms SET status = 'sold', status_updated_at = ?, updated_at = ?, current_deposit = NULL WHERE id = ?",
      [nowStr, nowStr, roomId]
    );
    await recordEvent(conn, {
      roomId,
      fromStatus: room.status,
      toStatus: "sold",
      type: "contract_signed",
      occurredAt: nowStr,
      contract: settlement,
    });
    await conn.commit();
    return {
      room: { ...room, status: "sold", statusUpdatedAt: nowStr, updatedAt: nowStr, currentDeposit: undefined },
      settlement,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ------------------------------- History ---------------------------------

export async function listRoomEvents(roomId: string): Promise<RoomStatusEvent[]> {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM room_status_events WHERE room_id = ? ORDER BY occurred_at DESC",
    [roomId]
  );
  return (rows as unknown[]).map(rowToEvent);
}

/** All contract_signed / deposit_cancelled events across every room — the
 * data behind the "Hoa hồng & lì xì" admin report. */
export async function listAllEvents(): Promise<RoomStatusEvent[]> {
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM room_status_events ORDER BY occurred_at DESC");
  return (rows as unknown[]).map(rowToEvent);
}

// ------------------------------ Documents ---------------------------------

export async function addRoomDocument(
  roomId: string,
  doc: { type: DocumentType; fileUrl: string; fileName: string; note?: string }
): Promise<RoomDocument | { error: string }> {
  const pool = getPool();
  const [roomRows] = await pool.query("SELECT id FROM rooms WHERE id = ?", [roomId]);
  if (!(roomRows as unknown[]).length) return { error: "Không tìm thấy phòng." };

  const record: RoomDocument = {
    id: `doc-${randomUUID()}`,
    roomId,
    type: doc.type,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
    uploadedAt: nowIso(),
    note: doc.note,
  };
  await pool.query(
    `INSERT INTO room_documents (id, room_id, type, file_url, file_name, uploaded_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.roomId, record.type, record.fileUrl, record.fileName, record.uploadedAt, record.note ?? null]
  );
  return record;
}

export async function listRoomDocuments(roomId: string): Promise<RoomDocument[]> {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM room_documents WHERE room_id = ? ORDER BY uploaded_at DESC",
    [roomId]
  );
  return (rows as unknown[]).map(rowToDocument);
}

export async function deleteRoomDocument(id: string): Promise<boolean> {
  const pool = getPool();
  const [result] = await pool.query("DELETE FROM room_documents WHERE id = ?", [id]);
  return (result as { affectedRows: number }).affectedRows > 0;
}
