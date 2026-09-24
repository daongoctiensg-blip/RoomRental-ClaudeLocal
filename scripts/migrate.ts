import fs from "fs";
import path from "path";
import { getPool } from "@/lib/mysqlPool";
import { buildSeedDatabase } from "@/lib/seed";

// Next.js auto-loads .env for `next build`/`next start`, but a plain script
// run via `tsx` does not — load it by hand here. getPool() only reads
// process.env lazily when actually called (inside main(), below), so as
// long as loadEnvFile() runs before main() is invoked, order is fine even
// though the imports above are hoisted.
function loadEnvFile(): void {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile();

// Real MySQL 8.0 rejects `ADD COLUMN IF NOT EXISTS` / `ADD INDEX IF NOT
// EXISTS` as a syntax error (verified against a real MySQL 8.0.46 instance —
// that syntax is a MariaDB-only extension, not standard MySQL, despite an
// earlier version of this script's comment incorrectly claiming both
// support it). Do the "if not exists" check in code instead: read
// information_schema first, only ALTER when the column/index is actually
// missing. Safe to run on every migrate — a no-op once already applied.
//
// Found in QA: the information_schema-check-then-ALTER isn't atomic, so if
// two deploys/migrate runs happen to overlap (deploy scripts sometimes
// double-run), both can see the column/index missing and both attempt the
// ALTER — the loser gets a real MySQL error (1060 duplicate column / 1061
// duplicate key name), not a silent no-op. Since that specific failure mode
// only ever means "someone else already added it, which is exactly the
// state we wanted," it's caught and treated as success rather than crashing
// the whole migrate run.
const ER_DUP_FIELDNAME = 1060;
const ER_DUP_KEYNAME = 1061;

async function alterIfMissing(
  pool: import("mysql2/promise").Pool,
  sql: string,
  label: string
): Promise<void> {
  try {
    console.log(`${label}...`);
    await pool.query(sql);
  } catch (err) {
    const errno = (err as { errno?: number }).errno;
    if (errno === ER_DUP_FIELDNAME || errno === ER_DUP_KEYNAME) {
      console.log(`${label}: already applied by a concurrent run, skipping.`);
      return;
    }
    throw err;
  }
}

async function ensureCityWardColumns(pool: import("mysql2/promise").Pool): Promise<void> {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
       AND COLUMN_NAME IN ('city', 'ward', 'district')`
  );
  const existing = new Set((cols as { COLUMN_NAME: string }[]).map((c) => c.COLUMN_NAME));

  if (!existing.has("city")) {
    await alterIfMissing(
      pool,
      "ALTER TABLE properties ADD COLUMN city VARCHAR(255) NOT NULL DEFAULT '' AFTER address_old",
      "Adding properties.city column"
    );
  }
  if (!existing.has("ward")) {
    await alterIfMissing(
      pool,
      "ALTER TABLE properties ADD COLUMN ward VARCHAR(255) NOT NULL DEFAULT '' AFTER city",
      "Adding properties.ward column"
    );
  }
  if (!existing.has("district")) {
    await alterIfMissing(
      pool,
      "ALTER TABLE properties ADD COLUMN district VARCHAR(255) NOT NULL DEFAULT '' AFTER ward",
      "Adding properties.district column"
    );
  }

  const [idx] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
       AND INDEX_NAME = 'idx_properties_city_ward'`
  );
  if ((idx as unknown[]).length === 0) {
    await alterIfMissing(
      pool,
      "ALTER TABLE properties ADD INDEX idx_properties_city_ward (city, ward)",
      "Adding idx_properties_city_ward index"
    );
  }

  const [idxDistrict] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
       AND INDEX_NAME = 'idx_properties_district'`
  );
  if ((idxDistrict as unknown[]).length === 0) {
    await alterIfMissing(
      pool,
      "ALTER TABLE properties ADD INDEX idx_properties_district (district)",
      "Adding idx_properties_district index"
    );
  }
}

// Additive migration for the 3 new business fields confirmed with the owner
// (see room-rental-platform-business-requirements-v6-addendum.md):
// properties.customer_promotion (public promo banner, separate from the
// internal sale_bonus_policy), rooms.max_occupancy ("Số người ở" filter),
// rooms.view_count (real view counter). Same information_schema-check-then-
// ALTER pattern as ensureCityWardColumns() above.
async function ensureNewBusinessFieldsColumns(pool: import("mysql2/promise").Pool): Promise<void> {
  const [propCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
       AND COLUMN_NAME = 'customer_promotion'`
  );
  if ((propCols as unknown[]).length === 0) {
    await alterIfMissing(
      pool,
      "ALTER TABLE properties ADD COLUMN customer_promotion TEXT NULL AFTER sale_bonus_policy",
      "Adding properties.customer_promotion column"
    );
  }

  const [roomCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rooms'
       AND COLUMN_NAME IN ('max_occupancy', 'view_count')`
  );
  const existingRoomCols = new Set((roomCols as { COLUMN_NAME: string }[]).map((c) => c.COLUMN_NAME));

  if (!existingRoomCols.has("max_occupancy")) {
    await alterIfMissing(
      pool,
      "ALTER TABLE rooms ADD COLUMN max_occupancy INT NULL AFTER price_monthly",
      "Adding rooms.max_occupancy column"
    );
  }
  if (!existingRoomCols.has("view_count")) {
    await alterIfMissing(
      pool,
      "ALTER TABLE rooms ADD COLUMN view_count INT NOT NULL DEFAULT 0 AFTER max_occupancy",
      "Adding rooms.view_count column"
    );
  }
}

// Additive migration for rooms.internal_notes (round 11 — admin/sale-only
// free text, separate from the public `description` column). Same
// information_schema-check-then-ALTER pattern as the functions above.
// waterFeeMode (also round 11) needs NO migration here: UtilityFeeVersion
// lives inside the properties.utility_fee_versions JSON column, so a new
// optional key just starts appearing in newly-written JSON — nothing to
// ALTER.
async function ensureInternalNotesColumn(pool: import("mysql2/promise").Pool): Promise<void> {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rooms'
       AND COLUMN_NAME = 'internal_notes'`
  );
  if ((cols as unknown[]).length === 0) {
    await alterIfMissing(
      pool,
      "ALTER TABLE rooms ADD COLUMN internal_notes TEXT NULL AFTER description",
      "Adding rooms.internal_notes column"
    );
  }
}

async function main() {
  const pool = getPool();

  const schemaPath = path.join(process.cwd(), "scripts", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  // Strip full-line comments FIRST, then split on ";" — splitting first and
  // filtering segments that merely *start* with "--" is wrong: a comment
  // line directly followed by a real statement (no blank line / ";" between
  // them) would drop the statement along with its comment.
  const withoutComments = schemaSql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Running ${statements.length} schema statement(s)...`);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
  console.log("Schema OK.");

  await ensureCityWardColumns(pool);
  await ensureNewBusinessFieldsColumns(pool);
  await ensureInternalNotesColumn(pool);

  const [rows] = await pool.query("SELECT COUNT(*) AS n FROM properties");
  const count = (rows as { n: number }[])[0].n;
  if (count > 0) {
    console.log(`properties table already has ${count} row(s) — skipping seed.`);
    await pool.end();
    return;
  }

  console.log("properties table is empty — seeding initial data...");
  const seed = buildSeedDatabase();

  for (const p of seed.properties) {
    await pool.query(
      `INSERT INTO properties
        (id, name, address_new, address_old, city, ward, district, lat, lng, contact_phone,
         landlord_name, landlord_contact_phone, landlord_zalo,
         amenities_shared, transport_notes, utility_fee_versions,
         deposit_policy, deposit_cancellation_policy, commission_policy,
         sale_bonus_policy, customer_promotion, images, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.name,
        p.addressNew,
        p.addressOld ?? null,
        p.city,
        p.ward,
        p.district,
        p.lat ?? null,
        p.lng ?? null,
        p.contactPhone,
        p.landlordName ?? null,
        p.landlordContactPhone ?? null,
        p.landlordZalo ?? null,
        JSON.stringify(p.amenitiesShared),
        JSON.stringify(p.transportNotes),
        JSON.stringify(p.utilityFeeVersions),
        JSON.stringify(p.depositPolicy),
        JSON.stringify(p.depositCancellationPolicy),
        JSON.stringify(p.commissionPolicy),
        p.saleBonusPolicy ? JSON.stringify(p.saleBonusPolicy) : null,
        p.customerPromotion ?? null,
        JSON.stringify(p.images),
        p.isActive ? 1 : 0,
        p.createdAt,
        p.updatedAt,
      ]
    );
  }

  for (const r of seed.rooms) {
    await pool.query(
      `INSERT INTO rooms
        (id, property_id, code, floor, area_sqm, has_balcony, price_monthly,
         max_occupancy, view_count,
         status, status_updated_at, current_deposit, sub_units,
         amenities_override, images, description, internal_notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.propertyId,
        r.code,
        r.floor ?? null,
        r.areaSqm,
        r.hasBalcony ? 1 : 0,
        r.priceMonthly,
        r.maxOccupancy ?? null,
        r.viewCount ?? 0,
        r.status,
        r.statusUpdatedAt,
        r.currentDeposit ? JSON.stringify(r.currentDeposit) : null,
        r.subUnits ? JSON.stringify(r.subUnits) : null,
        r.amenitiesOverride ? JSON.stringify(r.amenitiesOverride) : null,
        JSON.stringify(r.images),
        r.description ?? null,
        r.internalNotes ?? null,
        r.isActive ? 1 : 0,
        r.createdAt,
        r.updatedAt,
      ]
    );
  }

  console.log(`Seeded ${seed.properties.length} property(ies), ${seed.rooms.length} room(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
