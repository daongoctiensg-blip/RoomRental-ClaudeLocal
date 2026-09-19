import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  Database,
  Property,
  Room,
  RoomFilter,
  RoomStatus,
  RoomWithProperty,
  UtilityFeeVersion,
} from "@/types";
import { buildSeedDatabase } from "@/lib/seed";

// ---------------------------------------------------------------------------
// JSON-file "database". Every read/write goes through this module, and every
// function here returns/accepts the same shapes defined in src/types. When the
// owner points this app at a real database on the VPS, only this file (and its
// sibling data files) should need to change — swap the internals for SQL/ORM
// calls but keep the exported function signatures identical, and the rest of
// the app (API routes, pages) keeps working untouched.
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "room-rental-data") // Vercel: chỉ /tmp ghi được, còn lại là read-only
  : path.join(process.cwd(), "data");     // VPS: giữ nguyên chỗ cũ, bền qua các lần restart
const DB_PATH = path.join(DATA_DIR, "db.json");

/** Thư mục lưu ảnh admin upload — cùng gốc ghi được với DB, nên ăn theo đúng
 * quy tắc VPS-vs-Vercel ở trên (không cần tự quyết lại nơi ghi lần 2). */
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/** Ghi 1 file ảnh admin vừa upload. Gọi từ route API, không đụng fs trực tiếp
 * ở route.ts — path tính động (Vercel/tmp vs VPS/data) nên phải gom vào đây,
 * ngoài không thì Next.js static-trace sẽ cảnh báo và kéo cả project vào build. */
export function saveUploadedFile(filename: string, bytes: Buffer): void {
  ensureUploadsDir();
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), bytes);
}

/** Đọc lại 1 file ảnh đã upload theo tên, dùng cho route phục vụ ảnh. */
export function readUploadedFile(filename: string): Buffer | null {
  const filePath = path.join(UPLOADS_DIR, filename);
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
  return JSON.parse(raw) as Database;
}

function writeDbSync(db: Database): void {
  ensureDataFile();
  // Atomic-ish write: write to a temp file then rename, so a crash mid-write
  // never leaves db.json truncated/corrupted.
  const tmpPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), "utf-8");
  fs.renameSync(tmpPath, DB_PATH);
}

async function withDb<T>(fn: (db: Database) => T): Promise<T> {
  const task = writeQueue.then(() => {
    const db = readDbSync();
    return fn(db);
  });
  // Keep the queue alive even if this particular task throws.
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

// ----------------------------- Properties -----------------------------

export async function listProperties(opts?: { includeInactive?: boolean }): Promise<Property[]> {
  return withDb((db) =>
    db.properties.filter((p) => opts?.includeInactive || p.isActive)
  );
}

export async function getProperty(id: string): Promise<Property | undefined> {
  return withDb((db) => db.properties.find((p) => p.id === id));
}

export type PropertyInput = Omit<
  Property,
  "id" | "createdAt" | "updatedAt"
>;

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
    property.utilityFeeVersions.push({
      ...version,
      id: `fee-${randomUUID()}`,
    });
    property.updatedAt = nowIso();
    return property;
  });
}

export function getCurrentUtilityFee(
  property: Property
): UtilityFeeVersion | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return [...property.utilityFeeVersions]
    .filter((v) => v.effectiveFrom <= today)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
}

// ------------------------------- Rooms ---------------------------------

export type RoomInput = Omit<Room, "id" | "createdAt" | "updatedAt" | "statusUpdatedAt">;

export async function listRooms(filter?: RoomFilter): Promise<RoomWithProperty[]> {
  return withDb((db) => {
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
  return withDb((db) => {
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

export async function updateRoom(
  id: string,
  input: Partial<RoomInput>
): Promise<Room | undefined> {
  return mutateDb((db) => {
    const room = db.rooms.find((r) => r.id === id);
    if (!room) return undefined;
    const statusChanged = input.status && input.status !== room.status;
    Object.assign(room, input, {
      updatedAt: nowIso(),
      ...(statusChanged ? { statusUpdatedAt: nowIso() } : {}),
    });
    return room;
  });
}

export async function setRoomStatus(
  id: string,
  status: RoomStatus
): Promise<Room | undefined> {
  return mutateDb((db) => {
    const room = db.rooms.find((r) => r.id === id);
    if (!room) return undefined;
    room.status = status;
    room.statusUpdatedAt = nowIso();
    room.updatedAt = nowIso();
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
