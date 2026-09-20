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
async function ensureCityWardColumns(pool: import("mysql2/promise").Pool): Promise<void> {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
       AND COLUMN_NAME IN ('city', 'ward')`
  );
  const existing = new Set((cols as { COLUMN_NAME: string }[]).map((c) => c.COLUMN_NAME));

  if (!existing.has("city")) {
    console.log("Adding properties.city column...");
    await pool.query(
      "ALTER TABLE properties ADD COLUMN city VARCHAR(255) NOT NULL DEFAULT '' AFTER address_old"
    );
  }
  if (!existing.has("ward")) {
    console.log("Adding properties.ward column...");
    await pool.query(
      "ALTER TABLE properties ADD COLUMN ward VARCHAR(255) NOT NULL DEFAULT '' AFTER city"
    );
  }

  const [idx] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
       AND INDEX_NAME = 'idx_properties_city_ward'`
  );
  if ((idx as unknown[]).length === 0) {
    console.log("Adding idx_properties_city_ward index...");
    await pool.query("ALTER TABLE properties ADD INDEX idx_properties_city_ward (city, ward)");
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
        (id, name, address_new, address_old, city, ward, lat, lng, contact_phone,
         landlord_name, landlord_contact_phone, landlord_zalo,
         amenities_shared, transport_notes, utility_fee_versions,
         deposit_policy, deposit_cancellation_policy, commission_policy,
         sale_bonus_policy, images, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.name,
        p.addressNew,
        p.addressOld ?? null,
        p.city,
        p.ward,
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
         status, status_updated_at, current_deposit, sub_units,
         amenities_override, images, description, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.propertyId,
        r.code,
        r.floor ?? null,
        r.areaSqm,
        r.hasBalcony ? 1 : 0,
        r.priceMonthly,
        r.status,
        r.statusUpdatedAt,
        r.currentDeposit ? JSON.stringify(r.currentDeposit) : null,
        r.subUnits ? JSON.stringify(r.subUnits) : null,
        r.amenitiesOverride ? JSON.stringify(r.amenitiesOverride) : null,
        JSON.stringify(r.images),
        r.description ?? null,
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
