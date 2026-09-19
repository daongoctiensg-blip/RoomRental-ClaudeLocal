import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { PoolConnection } from "mysql2/promise";
import type {
  CancellationSettlement,
  ContractSettlement,
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
    status: row.status,
    statusUpdatedAt: row.status_updated_at,
    currentDeposit: row.current_deposit ? parseJson(row.current_deposit, undefined) : undefined,
    subUnits: row.sub_units ? parseJson(row.sub_units, undefined) : undefined,
    amenitiesOverride: row.amenities_override
      ? parseJson(row.amenities_override, undefined)
      : undefined,
    images: parseJson(row.images, []),
    description: row.description ?? undefined,
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

export async function createProperty(input: PropertyInput): Promise<Property> {
  const pool = getPool();
  const property: Property = {
    ...input,
    id: `prop-${randomUUID()}`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await pool.query(
    `INSERT INTO properties
      (id, name, address_new, address_old, lat, lng, contact_phone,
       landlord_name, landlord_contact_phone, landlord_zalo,
       amenities_shared, transport_notes, utility_fee_versions,
       deposit_policy, deposit_cancellation_policy, commission_policy,
       sale_bonus_policy, images, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      property.id,
      property.name,
      property.addressNew,
      property.addressOld ?? null,
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
  lat: "lat",
  lng: "lng",
  contactPhone: "contact_phone",
  landlordName: "landlord_name",
  landlordContactPhone: "landlord_contact_phone",
  landlordZalo: "landlord_zalo",
  isActive: "is_active",
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
): Promise<Property | undefined> {
  const pool = getPool();
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(PROPERTY_COLUMN_MAP)) {
    if (key in input) {
      const v = (input as Record<string, unknown>)[key];
      sets.push(`${column} = ?`);
      values.push(key === "isActive" ? (v ? 1 : 0) : v ?? null);
    }
  }
  for (const [key, column] of Object.entries(PROPERTY_JSON_COLUMN_MAP)) {
    if (key in input) {
      const v = (input as Record<string, unknown>)[key];
      sets.push(`${column} = ?`);
      values.push(v === undefined ? null : JSON.stringify(v));
    }
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
  const { currentDeposit: _currentDeposit, propertyId: _propertyId, property, ...rest } = room;
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

export async function listRooms(filter?: RoomFilter): Promise<RoomWithProperty[]> {
  const pool = getPool();
  const conn = await pool.getConnection();
  let rows;
  try {
    await conn.beginTransaction();
    await sweepExpiredDeposits(conn, new Date());
    await conn.commit();

    const clauses: string[] = ["r.is_active = 1", "p.is_active = 1"];
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
    if (filter?.address) {
      const q = `%${filter.address.trim().toLowerCase()}%`;
      clauses.push("(LOWER(p.address_new) LIKE ? OR LOWER(p.address_old) LIKE ? OR LOWER(p.name) LIKE ?)");
      values.push(q, q, q);
    }

    [rows] = await conn.query(
      `SELECT r.*, p.*, r.id AS room_id_, p.id AS property_id_
       FROM rooms r JOIN properties p ON p.id = r.property_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY r.created_at DESC`,
      values
    );
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return (rows as Record<string, unknown>[]).map((row) => {
    const room = rowToRoom({ ...row, id: row.room_id_ });
    const property = rowToProperty({ ...row, id: row.property_id_ });
    return { ...room, property };
  });
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

export async function createRoom(input: RoomInput): Promise<Room> {
  const pool = getPool();
  const room: Room = {
    ...input,
    id: `room-${randomUUID()}`,
    statusUpdatedAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await pool.query(
    `INSERT INTO rooms
      (id, property_id, code, floor, area_sqm, has_balcony, price_monthly,
       status, status_updated_at, current_deposit, sub_units,
       amenities_override, images, description, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      room.id,
      room.propertyId,
      room.code,
      room.floor ?? null,
      room.areaSqm,
      room.hasBalcony ? 1 : 0,
      room.priceMonthly,
      room.status,
      room.statusUpdatedAt,
      room.currentDeposit ? JSON.stringify(room.currentDeposit) : null,
      room.subUnits ? JSON.stringify(room.subUnits) : null,
      room.amenitiesOverride ? JSON.stringify(room.amenitiesOverride) : null,
      JSON.stringify(room.images),
      room.description ?? null,
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
  description: "description",
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
      values.push(v === undefined ? null : JSON.stringify(v));
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
export function calculateCommission(
  priceMonthly: number,
  contractDurationMonths: number,
  commissionPolicy: { contractDurationMonths: number; commissionPercent: number }[]
): { commissionPercent: number; commissionAmount: number } {
  const exact = commissionPolicy.find(
    (t) => t.contractDurationMonths === contractDurationMonths
  );
  const tier =
    exact ??
    [...commissionPolicy]
      .filter((t) => t.contractDurationMonths <= contractDurationMonths)
      .sort((a, b) => b.contractDurationMonths - a.contractDurationMonths)[0];

  const commissionPercent = tier?.commissionPercent ?? 0;
  const commissionAmount = Math.round((priceMonthly * commissionPercent) / 100);
  return { commissionPercent, commissionAmount };
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
    const { commissionPercent, commissionAmount } = calculateCommission(
      room.priceMonthly,
      contractDurationMonths,
      property.commissionPolicy
    );
    const bonus = property.saleBonusPolicy;
    const bonusApplicable = !!bonus && isWithin(now, bonus.validFrom, bonus.validTo);
    const bonusAmount = bonusApplicable ? bonus!.amount : 0;

    const settlement: ContractSettlement = {
      contractDurationMonths,
      commissionPercent,
      commissionAmount,
      bonusApplicable,
      bonusAmount,
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
