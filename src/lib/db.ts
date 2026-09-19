import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  CancellationSettlement,
  ContractSettlement,
  Database,
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
import { buildSeedDatabase } from "@/lib/seed";

// ---------------------------------------------------------------------------
// JSON-file "database". Every read/write goes through this module, and every
// function here returns/accepts the same shapes defined in src/types. When the
// owner points this app at a real database, only this file (and its sibling
// data files) should need to change — swap the internals for SQL/ORM calls
// but keep the exported function signatures identical, and the rest of the
// app (API routes, pages) keeps working untouched.
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "room-rental-data") // Vercel: chỉ /tmp ghi được (KHÔNG bền — mất khi cold start/redeploy)
  : path.join(process.cwd(), "data"); // VPS: giữ nguyên chỗ cũ, bền qua các lần restart
const DB_PATH = path.join(DATA_DIR, "db.json");

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

// Documents (hợp đồng, giấy xác nhận cọc, ...) live in a SEPARATE directory
// from room photos and are served only through an admin-authenticated route
// (/api/documents/file/[filename]), unlike photos which are public by design.
// Don't reuse UPLOADS_DIR for these — mixing them would make it easy to
// accidentally serve a contract on the same unauthenticated path as a photo.
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

// Simple in-process write queue so concurrent requests don't interleave writes
// and corrupt the JSON file. Good enough for a single Node process on a VPS;
// a real DB would make this unnecessary.
let writeQueue: Promise<unknown> = Promise.resolve();

function ensureDataFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const seed = buildSeedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
  }
}

function readDbSync(): Database {
  ensureDataFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Partial<Database>;
  // Backfill collections added after some db.json files were already created,
  // so an older file on disk doesn't crash the app.
  return {
    properties: parsed.properties ?? [],
    rooms: parsed.rooms ?? [],
    roomStatusEvents: parsed.roomStatusEvents ?? [],
    roomDocuments: parsed.roomDocuments ?? [],
  };
}

function writeDbSync(db: Database): void {
  ensureDataFile();
  const tmpPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), "utf-8");
  fs.renameSync(tmpPath, DB_PATH);
}

async function withDb<T>(fn: (db: Database) => T): Promise<T> {
  const task = writeQueue.then(() => {
    const db = readDbSync();
    return fn(db);
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

async function mutateDb<T>(fn: (db: Database) => T): Promise<T> {
  const task = writeQueue.then(() => {
    const db = readDbSync();
    const result = fn(db);
    writeDbSync(db);
    return result;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

function nowIso(): string {
  return new Date().toISOString();
}

function recordEvent(
  db: Database,
  event: Omit<RoomStatusEvent, "id" | "occurredAt"> & { occurredAt?: string }
): RoomStatusEvent {
  const full: RoomStatusEvent = {
    id: `evt-${randomUUID()}`,
    occurredAt: event.occurredAt ?? nowIso(),
    ...event,
  };
  db.roomStatusEvents.push(full);
  return full;
}

// ----------------------------- Properties -----------------------------

export async function listProperties(opts?: { includeInactive?: boolean }): Promise<Property[]> {
  return withDb((db) =>
    db.properties.filter((p) => opts?.includeInactive || p.isActive)
  );
}

export async function getProperty(id: string): Promise<Property | undefined> {
  return withDb((db) => db.properties.find((p) => p.id === id));
}

export type PropertyInput = Omit<Property, "id" | "createdAt" | "updatedAt">;

export async function createProperty(input: PropertyInput): Promise<Property> {
  return mutateDb((db) => {
    const property: Property = {
      ...input,
      id: `prop-${randomUUID()}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.properties.push(property);
    return property;
  });
}

export async function updateProperty(
  id: string,
  input: Partial<PropertyInput>
): Promise<Property | undefined> {
  return mutateDb((db) => {
    const property = db.properties.find((p) => p.id === id);
    if (!property) return undefined;
    Object.assign(property, input, { updatedAt: nowIso() });
    return property;
  });
}

/** Soft-delete: keeps history, just hides it from the public site. */
export async function deactivateProperty(id: string): Promise<boolean> {
  return mutateDb((db) => {
    const property = db.properties.find((p) => p.id === id);
    if (!property) return false;
    property.isActive = false;
    property.updatedAt = nowIso();
    return true;
  });
}

/** Append a new utility fee version. Never mutates/overwrites a past version. */
export async function addUtilityFeeVersion(
  propertyId: string,
  version: Omit<UtilityFeeVersion, "id">
): Promise<Property | undefined> {
  return mutateDb((db) => {
    const property = db.properties.find((p) => p.id === propertyId);
    if (!property) return undefined;
    property.utilityFeeVersions.push({ ...version, id: `fee-${randomUUID()}` });
    property.updatedAt = nowIso();
    return property;
  });
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
//
// These strip every field that must never reach an unauthenticated visitor:
// landlord contact info, commission %, the deposit-cancellation 50/50 split,
// and the sale bonus ("lì xì"). Any endpoint or page that serves the public
// site must go through these, never hand back a raw Property/Room.

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
 * every read so the public site is never more than one request stale. */
function sweepExpiredDeposits(db: Database, now: Date): boolean {
  let changed = false;
  for (const room of db.rooms) {
    if (room.status !== "deposited" || !room.currentDeposit) continue;
    const deadline =
      new Date(room.currentDeposit.depositedAt).getTime() +
      room.currentDeposit.holdDays * 24 * 60 * 60 * 1000;
    if (now.getTime() < deadline) continue;

    const fromStatus = room.status;
    room.status = "available";
    room.statusUpdatedAt = now.toISOString();
    room.updatedAt = now.toISOString();
    room.currentDeposit = undefined;
    recordEvent(db, {
      roomId: room.id,
      fromStatus,
      toStatus: "available",
      type: "deposit_expired",
      occurredAt: now.toISOString(),
      note: "Khách không quay lại trong thời hạn giữ cọc — chủ nhà giữ toàn bộ tiền giữ chỗ.",
    });
    changed = true;
  }
  return changed;
}

export async function listRooms(filter?: RoomFilter): Promise<RoomWithProperty[]> {
  return mutateDb((db) => {
    sweepExpiredDeposits(db, new Date());

    const propertiesById = new Map(db.properties.map((p) => [p.id, p]));
    let rooms = db.rooms.filter((r) => r.isActive);

    if (filter?.propertyId) {
      rooms = rooms.filter((r) => r.propertyId === filter.propertyId);
    }
    if (filter?.status && filter.status.length > 0) {
      const statusSet = new Set(filter.status);
      rooms = rooms.filter((r) => statusSet.has(r.status));
    }
    if (typeof filter?.priceMin === "number") {
      rooms = rooms.filter((r) => r.priceMonthly >= filter.priceMin!);
    }
    if (typeof filter?.priceMax === "number") {
      rooms = rooms.filter((r) => r.priceMonthly < filter.priceMax!);
    }

    const withProperty: RoomWithProperty[] = rooms
      .map((r) => {
        const property = propertiesById.get(r.propertyId);
        if (!property || !property.isActive) return null;
        return { ...r, property };
      })
      .filter((r): r is RoomWithProperty => r !== null);

    if (filter?.address) {
      const q = filter.address.trim().toLowerCase();
      return withProperty.filter(
        (r) =>
          r.property.addressNew.toLowerCase().includes(q) ||
          (r.property.addressOld ?? "").toLowerCase().includes(q) ||
          r.property.name.toLowerCase().includes(q)
      );
    }

    return withProperty;
  });
}

export async function getRoom(id: string): Promise<RoomWithProperty | undefined> {
  return mutateDb((db) => {
    sweepExpiredDeposits(db, new Date());
    const room = db.rooms.find((r) => r.id === id);
    if (!room) return undefined;
    const property = db.properties.find((p) => p.id === room.propertyId);
    if (!property) return undefined;
    return { ...room, property };
  });
}

export async function createRoom(input: RoomInput): Promise<Room> {
  return mutateDb((db) => {
    const room: Room = {
      ...input,
      id: `room-${randomUUID()}`,
      statusUpdatedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.rooms.push(room);
    return room;
  });
}

/** Generic edit for a room's own fields. Deliberately ignores `status` —
 * status changes for "deposited"/"sold" must go through startDeposit /
 * cancelDeposit / signContract so the money math and history log stay
 * correct; use setRoomStatus only for the simple available<->renovating
 * cases that don't carry any financial meaning. */
export async function updateRoom(
  id: string,
  input: Partial<Omit<RoomInput, "status">>
): Promise<Room | undefined> {
  return mutateDb((db) => {
    const room = db.rooms.find((r) => r.id === id);
    if (!room) return undefined;
    Object.assign(room, input, { updatedAt: nowIso() });
    return room;
  });
}

/** Plain manual status change, for transitions with no money attached
 * (e.g. available <-> renovating, or an admin correcting a mistake). Blocks
 * moving *into* "deposited" or "sold" — those need startDeposit/signContract
 * so the required snapshot/settlement data is captured. */
export async function setRoomStatus(
  id: string,
  status: RoomStatus
): Promise<Room | { error: string } | undefined> {
  return mutateDb((db) => {
    const room = db.rooms.find((r) => r.id === id);
    if (!room) return undefined;
    if (status === "deposited" || status === "sold") {
      return {
        error:
          status === "deposited"
            ? "Dùng chức năng “Nhận cọc” để chuyển sang Đã cọc (cần lưu số tiền/ngày giữ)."
            : "Dùng chức năng “Chốt hợp đồng” để chuyển sang Đã cho thuê (cần chọn thời hạn hợp đồng để tính hoa hồng).",
      };
    }
    const fromStatus = room.status;
    room.status = status;
    room.statusUpdatedAt = nowIso();
    room.updatedAt = nowIso();
    room.currentDeposit = undefined;
    if (fromStatus !== status) {
      recordEvent(db, { roomId: room.id, fromStatus, toStatus: status, type: "status_change" });
    }
    return room;
  });
}

export async function deactivateRoom(id: string): Promise<boolean> {
  return mutateDb((db) => {
    const room = db.rooms.find((r) => r.id === id);
    if (!room) return false;
    room.isActive = false;
    room.updatedAt = nowIso();
    return true;
  });
}

// --------------------------- Deposit lifecycle ---------------------------

export async function startDeposit(
  roomId: string
): Promise<Room | { error: string } | undefined> {
  return mutateDb((db) => {
    const room = db.rooms.find((r) => r.id === roomId);
    if (!room) return undefined;
    if (room.status !== "available") {
      return { error: "Chỉ nhận cọc được cho phòng đang Còn trống." };
    }
    const property = db.properties.find((p) => p.id === room.propertyId);
    if (!property) return { error: "Không tìm thấy nhà của phòng này." };

    const fromStatus = room.status;
    const depositedAt = nowIso();
    room.status = "deposited";
    room.statusUpdatedAt = depositedAt;
    room.updatedAt = depositedAt;
    room.currentDeposit = {
      depositedAt,
      holdAmount: property.depositPolicy.holdAmount,
      holdDays: property.depositPolicy.holdDays,
    };
    recordEvent(db, {
      roomId: room.id,
      fromStatus,
      toStatus: "deposited",
      type: "deposit_started",
      deposit: {
        holdAmount: property.depositPolicy.holdAmount,
        holdDays: property.depositPolicy.holdDays,
      },
    });
    return room;
  });
}

/** The exact worked example the owner gave:
 * hold 2,000,000đ for 5 days => 400,000đ/day. Customer backs out on day 4 =>
 * landlord keeps 400,000 × 4 = 1,600,000 as compensation for holding the
 * room; the remaining 400,000 is split 50/50 (200k sale / 200k landlord). */
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
  // Subtract rather than recompute the landlord's cut, so rounding never
  // makes the two shares add up to more (or less) than the remainder.
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
  return mutateDb((db) => {
    const room = db.rooms.find((r) => r.id === roomId);
    if (!room) return undefined;
    if (room.status !== "deposited" || !room.currentDeposit) {
      return { error: "Phòng này hiện không ở trạng thái Đã cọc." };
    }
    const property = db.properties.find((p) => p.id === room.propertyId);
    if (!property) return { error: "Không tìm thấy nhà của phòng này." };

    const now = new Date();
    const settlement = calculateCancellationSettlement(
      room.currentDeposit.holdAmount,
      room.currentDeposit.holdDays,
      room.currentDeposit.depositedAt,
      now,
      property.depositCancellationPolicy.landlordSharePercent,
      property.depositCancellationPolicy.saleSharePercent
    );

    const fromStatus = room.status;
    room.status = "available";
    room.statusUpdatedAt = now.toISOString();
    room.updatedAt = now.toISOString();
    room.currentDeposit = undefined;

    recordEvent(db, {
      roomId: room.id,
      fromStatus,
      toStatus: "available",
      type: "deposit_cancelled",
      occurredAt: now.toISOString(),
      cancellation: settlement,
    });

    return { room, settlement };
  });
}

// --------------------------- Contract / commission ---------------------------

export function calculateCommission(
  priceMonthly: number,
  contractDurationMonths: number,
  commissionPolicy: { contractDurationMonths: number; commissionPercent: number }[]
): { commissionPercent: number; commissionAmount: number } {
  // Exact match first, else the highest tier at or below the chosen duration.
  const exact = commissionPolicy.find(
    (t) => t.contractDurationMonths === contractDurationMonths
  );
  const tier =
    exact ??
    [...commissionPolicy]
      .filter((t) => t.contractDurationMonths <= contractDurationMonths)
      .sort((a, b) => b.contractDurationMonths - a.contractDurationMonths)[0];

  const commissionPercent = tier?.commissionPercent ?? 0;
  // ASSUMPTION: % applies to one month's rent — see CommissionTier in src/types.
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
  return mutateDb((db) => {
    const room = db.rooms.find((r) => r.id === roomId);
    if (!room) return undefined;
    if (room.status !== "available" && room.status !== "deposited") {
      return { error: "Chỉ chốt hợp đồng được từ trạng thái Còn trống hoặc Đã cọc." };
    }
    const property = db.properties.find((p) => p.id === room.propertyId);
    if (!property) return { error: "Không tìm thấy nhà của phòng này." };

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

    const fromStatus = room.status;
    room.status = "sold";
    room.statusUpdatedAt = now.toISOString();
    room.updatedAt = now.toISOString();
    room.currentDeposit = undefined;

    recordEvent(db, {
      roomId: room.id,
      fromStatus,
      toStatus: "sold",
      type: "contract_signed",
      occurredAt: now.toISOString(),
      contract: settlement,
    });

    return { room, settlement };
  });
}

// ------------------------------- History ---------------------------------

export async function listRoomEvents(roomId: string): Promise<RoomStatusEvent[]> {
  return withDb((db) =>
    db.roomStatusEvents
      .filter((e) => e.roomId === roomId)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
  );
}

/** All contract_signed / deposit_cancelled events across every room — the
 * data behind the "Hoa hồng & lì xì" admin report. */
export async function listAllEvents(): Promise<RoomStatusEvent[]> {
  return withDb((db) =>
    [...db.roomStatusEvents].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
  );
}

// ------------------------------ Documents ---------------------------------

export async function addRoomDocument(
  roomId: string,
  doc: { type: DocumentType; fileUrl: string; fileName: string; note?: string }
): Promise<RoomDocument | { error: string }> {
  return mutateDb((db) => {
    const room = db.rooms.find((r) => r.id === roomId);
    if (!room) return { error: "Không tìm thấy phòng." };
    const record: RoomDocument = {
      id: `doc-${randomUUID()}`,
      roomId,
      type: doc.type,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      uploadedAt: nowIso(),
      note: doc.note,
    };
    db.roomDocuments.push(record);
    return record;
  });
}

export async function listRoomDocuments(roomId: string): Promise<RoomDocument[]> {
  return withDb((db) =>
    db.roomDocuments
      .filter((d) => d.roomId === roomId)
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
  );
}

export async function deleteRoomDocument(id: string): Promise<boolean> {
  return mutateDb((db) => {
    const idx = db.roomDocuments.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    db.roomDocuments.splice(idx, 1);
    return true;
  });
}
