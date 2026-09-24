-- Room Rental — MySQL schema (replaces the JSON-file store in src/lib/db.ts)
-- Run once via: npm run db:migrate
--
-- Design: real columns for anything the app filters/sorts by (status, price,
-- foreign keys, timestamps); JSON columns for nested/variable-shape data that
-- maps directly to the TypeScript types in src/types/index.ts (amenities
-- lists, deposit/commission/bonus policies, event payloads). This keeps the
-- migration low-risk — most fields serialize 1:1 with what was already in
-- data/db.json — while still getting real transactions, foreign keys, and
-- indexes where they matter.
--
-- All timestamps are stored as the exact ISO-8601 strings the app already
-- produces (VARCHAR, not DATETIME) — avoids any timezone-conversion bugs,
-- and ISO strings still sort correctly as plain text.

CREATE TABLE IF NOT EXISTS properties (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address_new VARCHAR(500) NOT NULL,
  address_old VARCHAR(500) NULL,
  -- city/ward: structured (not free-text) fields backing the exact-match
  -- "Thành phố"/"Phường-Xã" dropdown filters, distinct from the fuzzy
  -- free-text search box (address_new/address_old + geocoding). Declared
  -- here too (not just in the ALTER TABLE below) so a brand-new database
  -- created from this file in one pass ends up with the exact same shape,
  -- without depending on the ALTER statements running at all.
  city VARCHAR(255) NOT NULL DEFAULT '',
  ward VARCHAR(255) NOT NULL DEFAULT '',
  -- district: Quận/Huyện, from the OLD address system (address_old) — a
  -- separate exact-match dropdown from ward, since many customers still
  -- think/search in terms of the old district names.
  district VARCHAR(255) NOT NULL DEFAULT '',
  lat DOUBLE NULL,
  lng DOUBLE NULL,
  contact_phone VARCHAR(50) NOT NULL,
  landlord_name VARCHAR(255) NULL,
  landlord_contact_phone VARCHAR(50) NULL,
  landlord_zalo VARCHAR(100) NULL,
  amenities_shared JSON NOT NULL,
  transport_notes JSON NOT NULL,
  utility_fee_versions JSON NOT NULL,
  deposit_policy JSON NOT NULL,
  deposit_cancellation_policy JSON NOT NULL,
  commission_policy JSON NOT NULL,
  sale_bonus_policy JSON NULL,
  -- Public, free-text customer promotion banner — genuinely separate from
  -- sale_bonus_policy above (that one is internal, never shown to
  -- customers). See ensureNewBusinessFieldsColumns() in migrate.ts for the
  -- additive ALTER on pre-existing databases.
  customer_promotion TEXT NULL,
  images JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(30) NOT NULL,
  updated_at VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Additive migration for a `properties` table that already existed in
-- production before city/ward were introduced. `CREATE TABLE IF NOT EXISTS`
-- above does nothing once the table exists — it will NOT add new columns to
-- it. Real MySQL 8.0 does NOT support `ADD COLUMN IF NOT EXISTS` (that is a
-- MariaDB-only extension — confirmed by actually running this against real
-- MySQL 8.0.46, which rejects it with a syntax error), so this step is done
-- in code instead: see ensureCityWardColumns() in scripts/migrate.ts, which
-- checks information_schema first and only runs a plain ALTER TABLE when
-- the column is actually missing.

CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(64) PRIMARY KEY,
  property_id VARCHAR(64) NOT NULL,
  code VARCHAR(50) NOT NULL,
  floor VARCHAR(50) NULL,
  area_sqm DECIMAL(10,2) NOT NULL,
  has_balcony TINYINT(1) NOT NULL DEFAULT 0,
  price_monthly DECIMAL(14,2) NOT NULL,
  -- max_occupancy: optional, backs the "Số người ở" customer filter only.
  max_occupancy INT NULL,
  -- view_count: real counter, incremented once per detail-page open for
  -- every viewer type (customer/sale/admin). Never randomized.
  view_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL,
  status_updated_at VARCHAR(30) NOT NULL,
  current_deposit JSON NULL,
  sub_units JSON NULL,
  amenities_override JSON NULL,
  images JSON NOT NULL,
  description TEXT NULL,
  -- internal_notes: admin/sale-only free text (round 11), separate from the
  -- public `description` above — never sent to a customer, see toPublicRoom().
  internal_notes TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(30) NOT NULL,
  updated_at VARCHAR(30) NOT NULL,
  INDEX idx_rooms_property_id (property_id),
  INDEX idx_rooms_status (status),
  INDEX idx_rooms_price (price_monthly),
  CONSTRAINT fk_rooms_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only audit log — the app never issues UPDATE/DELETE against this
-- table (see src/lib/db.ts), only INSERT + SELECT.
CREATE TABLE IF NOT EXISTS room_status_events (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  occurred_at VARCHAR(30) NOT NULL,
  from_status VARCHAR(20) NOT NULL,
  to_status VARCHAR(20) NOT NULL,
  type VARCHAR(30) NOT NULL,
  note TEXT NULL,
  deposit JSON NULL,
  cancellation JSON NULL,
  contract JSON NULL,
  INDEX idx_events_room_id (room_id),
  INDEX idx_events_occurred_at (occurred_at),
  CONSTRAINT fk_events_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_documents (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  type VARCHAR(50) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  uploaded_at VARCHAR(30) NOT NULL,
  note TEXT NULL,
  INDEX idx_documents_room_id (room_id),
  CONSTRAINT fk_documents_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
