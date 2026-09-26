// Server-only data access for the amenity master data ("danh mục tiện ích")
// — round 12. See src/lib/amenities.ts for the design notes and the
// client-safe helpers/types.
import { randomUUID } from "crypto";
import type { Pool, PoolConnection } from "mysql2/promise";
import { getPool } from "@/lib/mysqlPool";
import {
  type Amenity,
  type AmenityGroupKey,
  type AmenityWithUsage,
  cleanAmenityLabel,
  isAmenityGroupKey,
  isAmenityIconKey,
  normalizeAmenityName,
} from "@/lib/amenities";

type Db = Pool | PoolConnection;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAmenity(row: any): Amenity {
  return {
    id: row.id,
    name: row.name,
    group: isAmenityGroupKey(row.group_key) ? row.group_key : "other",
    icon: row.icon || "check",
    isPopular: Boolean(row.is_popular),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function parseNameList(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : null;
}

export async function listAmenities(db: Db = getPool()): Promise<Amenity[]> {
  const [rows] = await db.query(
    "SELECT * FROM amenities ORDER BY is_popular DESC, sort_order ASC, name ASC"
  );
  return (rows as unknown[]).map(rowToAmenity);
}

/** Catalog + how many properties/rooms use each item — for the admin page
 * (an item can only be deleted once nothing uses it). */
export async function listAmenitiesWithUsage(): Promise<AmenityWithUsage[]> {
  const pool = getPool();
  const catalog = await listAmenities(pool);
  const counts = new Map<string, number>();
  const bump = (names: string[] | null) => {
    for (const key of new Set((names ?? []).map(normalizeAmenityName))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  };
  const [props] = await pool.query("SELECT amenities_shared FROM properties");
  for (const r of props as { amenities_shared: unknown }[]) bump(parseNameList(r.amenities_shared));
  // Round 12e: a room "uses" an amenity only by ADDING it. A name in a
  // room's removed list isn't a use (the room explicitly doesn't have it);
  // deleteAmenity() strips such leftovers instead.
  const [rooms] = await pool.query(
    "SELECT amenities_added FROM rooms WHERE amenities_added IS NOT NULL"
  );
  for (const r of rooms as { amenities_added: unknown }[]) bump(parseNameList(r.amenities_added));
  return catalog.map((a) => ({ ...a, usageCount: counts.get(normalizeAmenityName(a.name)) ?? 0 }));
}

async function nextSortOrder(db: Db): Promise<number> {
  const [rows] = await db.query("SELECT COALESCE(MAX(sort_order), 0) AS m FROM amenities");
  return Number((rows as { m: number }[])[0].m) + 1;
}

/** Insert-if-missing by normalized name. Returns the catalog row either way
 * (the existing one wins — its spelling/group/icon are kept). INSERT IGNORE
 * + re-select makes two admins adding the same name at the same moment
 * harmless: the UNIQUE name_key just turns the loser into a no-op. */
export async function ensureAmenity(
  rawName: string,
  opts?: { group?: AmenityGroupKey; icon?: string; isPopular?: boolean },
  db: Db = getPool()
): Promise<{ amenity: Amenity; created: boolean } | { error: string }> {
  const name = cleanAmenityLabel(rawName);
  if (!name) return { error: "Tên tiện ích không được để trống." };
  if (name.length > 100) return { error: "Tên tiện ích tối đa 100 ký tự." };
  const key = normalizeAmenityName(name);

  const [existing] = await db.query("SELECT * FROM amenities WHERE name_key = ?", [key]);
  if ((existing as unknown[]).length > 0) {
    return { amenity: rowToAmenity((existing as unknown[])[0]), created: false };
  }
  const [result] = await db.query(
    `INSERT IGNORE INTO amenities (id, name, name_key, group_key, icon, is_popular, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `amen-${randomUUID()}`,
      name,
      key,
      opts?.group ?? "other",
      opts?.icon && isAmenityIconKey(opts.icon) ? opts.icon : "check",
      opts?.isPopular ? 1 : 0,
      await nextSortOrder(db),
      new Date().toISOString(),
    ]
  );
  const [rows] = await db.query("SELECT * FROM amenities WHERE name_key = ?", [key]);
  return {
    amenity: rowToAmenity((rows as unknown[])[0]),
    created: (result as { affectedRows: number }).affectedRows > 0,
  };
}

/** The invariant-keeper: called on every property/room save. Trims, drops
 * empties and duplicates, replaces each name with the catalog's own
 * spelling, and adds any name the catalog doesn't have yet (group "Khác").
 * This is also the safety net behind the admin picker's type-and-Enter: even
 * if the picker's own POST failed, saving the form still registers the new
 * name. */
export async function canonicalizeAmenityNames(
  names: string[] | undefined | null,
  db: Db = getPool()
): Promise<string[]> {
  if (!names) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    if (typeof raw !== "string") continue;
    const key = normalizeAmenityName(raw);
    if (!key || seen.has(key)) continue;
    const res = await ensureAmenity(raw, undefined, db);
    if ("error" in res) continue;
    seen.add(key);
    out.push(res.amenity.name);
  }
  return out;
}

/** Round 12e: canonicalizes a room's added/removed pair. Both lists go
 * through the catalog (new "added" names are registered); a name can't be
 * both added and removed — "added" wins (the admin's latest explicit
 * intent is "this room has it"). Empty lists come back as undefined so they
 * are stored as NULL. */
export async function canonicalizeAmenityDelta(
  added: string[] | undefined | null,
  removed: string[] | undefined | null,
  db: Db = getPool()
): Promise<{ added?: string[]; removed?: string[] }> {
  const a = await canonicalizeAmenityNames(added, db);
  const aKeys = new Set(a.map(normalizeAmenityName));
  const r = (await canonicalizeAmenityNames(removed, db)).filter(
    (n) => !aKeys.has(normalizeAmenityName(n))
  );
  return { added: a.length ? a : undefined, removed: r.length ? r : undefined };
}

/** Rewrites one amenity name to another inside every property/room list
 * that contains it — what keeps a catalog rename from orphaning the names
 * already saved on properties/rooms. */
async function replaceAmenityNameEverywhere(
  conn: PoolConnection,
  oldName: string,
  newName: string
): Promise<void> {
  const oldKey = normalizeAmenityName(oldName);
  const rewrite = (list: string[]) => {
    let changed = false;
    const seen = new Set<string>();
    const next: string[] = [];
    for (const n of list) {
      const replaced = normalizeAmenityName(n) === oldKey ? ((changed = true), newName) : n;
      const k = normalizeAmenityName(replaced);
      if (seen.has(k)) continue;
      seen.add(k);
      next.push(replaced);
    }
    return changed ? next : null;
  };

  const [props] = await conn.query("SELECT id, amenities_shared FROM properties FOR UPDATE");
  for (const r of props as { id: string; amenities_shared: unknown }[]) {
    const next = rewrite(parseNameList(r.amenities_shared) ?? []);
    if (next) {
      await conn.query("UPDATE properties SET amenities_shared = ? WHERE id = ?", [
        JSON.stringify(next),
        r.id,
      ]);
    }
  }
  const [rooms] = await conn.query(
    `SELECT id, amenities_added, amenities_removed FROM rooms
     WHERE amenities_added IS NOT NULL OR amenities_removed IS NOT NULL FOR UPDATE`
  );
  for (const r of rooms as { id: string; amenities_added: unknown; amenities_removed: unknown }[]) {
    for (const column of ["amenities_added", "amenities_removed"] as const) {
      const next = rewrite(parseNameList(r[column]) ?? []);
      if (next) {
        await conn.query(`UPDATE rooms SET ${column} = ? WHERE id = ?`, [JSON.stringify(next), r.id]);
      }
    }
  }
}

export async function updateAmenity(
  id: string,
  patch: { name?: string; group?: string; icon?: string; isPopular?: boolean }
): Promise<Amenity | { error: string } | undefined> {
  if (patch.group !== undefined && !isAmenityGroupKey(patch.group)) {
    return { error: "Nhóm tiện ích không hợp lệ." };
  }
  if (patch.icon !== undefined && !isAmenityIconKey(patch.icon)) {
    return { error: "Biểu tượng không hợp lệ." };
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM amenities WHERE id = ? FOR UPDATE", [id]);
    if ((rows as unknown[]).length === 0) {
      await conn.rollback();
      return undefined;
    }
    const current = rowToAmenity((rows as unknown[])[0]);
    const sets: string[] = [];
    const values: unknown[] = [];

    if (patch.name !== undefined) {
      const name = cleanAmenityLabel(patch.name);
      if (!name) {
        await conn.rollback();
        return { error: "Tên tiện ích không được để trống." };
      }
      if (name.length > 100) {
        await conn.rollback();
        return { error: "Tên tiện ích tối đa 100 ký tự." };
      }
      const key = normalizeAmenityName(name);
      const [dup] = await conn.query("SELECT id, name FROM amenities WHERE name_key = ? AND id <> ?", [
        key,
        id,
      ]);
      if ((dup as unknown[]).length > 0) {
        await conn.rollback();
        return {
          error: `Đã có tiện ích "${(dup as { name: string }[])[0].name}" trong danh mục.`,
        };
      }
      if (name !== current.name) {
        sets.push("name = ?", "name_key = ?");
        values.push(name, key);
        await replaceAmenityNameEverywhere(conn, current.name, name);
      }
    }
    if (patch.group !== undefined) {
      sets.push("group_key = ?");
      values.push(patch.group);
    }
    if (patch.icon !== undefined) {
      sets.push("icon = ?");
      values.push(patch.icon);
    }
    if (patch.isPopular !== undefined) {
      sets.push("is_popular = ?");
      values.push(patch.isPopular ? 1 : 0);
    }
    if (sets.length > 0) {
      values.push(id);
      await conn.query(`UPDATE amenities SET ${sets.join(", ")} WHERE id = ?`, values);
    }
    await conn.commit();
    const [after] = await pool.query("SELECT * FROM amenities WHERE id = ?", [id]);
    return rowToAmenity((after as unknown[])[0]);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Only an unused item can be deleted — deleting one still saved on a
 * property/room would silently strip it from that listing. */
export async function deleteAmenity(id: string): Promise<true | { error: string } | undefined> {
  const all = await listAmenitiesWithUsage();
  const item = all.find((a) => a.id === id);
  if (!item) return undefined;
  if (item.usageCount > 0) {
    return {
      error: `"${item.name}" đang được dùng ở ${item.usageCount} tòa nhà/phòng — bỏ chọn ở đó trước rồi mới xoá được.`,
    };
  }
  // Strip the name from any room's "removed" list too — otherwise, if the
  // same name were re-created later, those rooms would silently hide it.
  const pool = getPool();
  const key = normalizeAmenityName(item.name);
  const [rows] = await pool.query(
    "SELECT id, amenities_removed FROM rooms WHERE amenities_removed IS NOT NULL"
  );
  for (const r of rows as { id: string; amenities_removed: unknown }[]) {
    const list = parseNameList(r.amenities_removed) ?? [];
    const next = list.filter((n) => normalizeAmenityName(n) !== key);
    if (next.length !== list.length) {
      await pool.query("UPDATE rooms SET amenities_removed = ? WHERE id = ?", [
        next.length ? JSON.stringify(next) : null,
        r.id,
      ]);
    }
  }
  await pool.query("DELETE FROM amenities WHERE id = ?", [id]);
  return true;
}
