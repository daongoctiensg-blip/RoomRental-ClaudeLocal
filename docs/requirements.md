# Room Rental Listing Platform — Product Requirements Document

**Version:** 1.0
**Purpose:** Source-of-truth requirements to hand to any AI coding tool / development team to build the product. Written to be self-contained — no external context needed.

---

## 1. Business Context

The owner (referred to as "Admin" below) manages one or more rental **Properties** (houses/apartment buildings). Each Property contains a variable number of **Rooms** (not a fixed count — a Property can have anywhere from 1 to N rooms, and this number can change over time as rooms are added, merged, or split).

Each Room can be independently rented out. Some attributes are defined at the Property level and apply to every Room in that Property by default (shared policies, amenities, fees). Some attributes belong to the Room itself and can differ from room to room, or can override a Property-level default when needed.

The core need is a public-facing website (responsive, mobile-first — not necessarily two separate native apps) where prospective tenants can browse available rooms, filter them, and contact the owner to arrange a viewing. The owner needs an admin-only interface to manage Property and Room data on an ongoing basis.

This is **not** an OTA / hotel-booking product. There is no nightly pricing, no online payment, no automated booking/checkout flow. Rent is monthly/long-term. The end goal of a visitor's journey is always: *find a room → contact the owner directly (phone/Zalo) → owner arranges an in-person viewing → deposit/contract happens offline.*

---

## 2. Data Model

### 2.1 Property (the house/building)

A Property represents one physical building. It has:

| Field | Type | Notes |
|---|---|---|
| `id` | string/UUID | primary key |
| `name` | string | internal label for Admin (e.g. "CHDV Lô C6 - Nam Long") |
| `address_new` | string | current official address (ward-based, post administrative-boundary-reform format), e.g. "Khu phố 2, Phường Phú Thuận, TP. Hồ Chí Minh" |
| `address_old` | string, nullable | legacy address using the old district system, e.g. "Quận 7, TP. Hồ Chí Minh" — kept because tenants and older listings still reference the old format |
| `lat`, `lng` | float, nullable | for future map display |
| `contact_phone` | string | phone number tenants call/message to arrange a viewing |
| `amenities_shared` | array of strings / structured list | amenities common to all rooms unless a room overrides them (e.g. "Đầy đủ nội thất", "WC riêng", "Miễn phí gửi xe") |
| `transport_notes` | array of strings | proximity/convenience bullet points (e.g. "Gần chợ, siêu thị", "Giáp khu Phú Mỹ Hưng") |
| `utility_fees` | structured, versioned (see 2.3) | electricity/water/service fee rates |
| `deposit_policy` | structured | deposit amount, hold period, forfeiture rules (see 2.4) |
| `commission_policy` | array of `{ contract_duration_months, commission_percent }` | e.g. 6 months → 50%, 12 months → 80% |
| `promotion` | structured, nullable | optional time-boxed promo: `{ description, valid_from, valid_to }` |
| `images` | array of image URLs | building/exterior/common-area photos |
| `is_active` | boolean | soft-hide the whole property without deleting it |
| `created_at`, `updated_at` | timestamp | |

### 2.2 Room (belongs to exactly one Property)

| Field | Type | Notes |
|---|---|---|
| `id` | string/UUID | primary key |
| `property_id` | FK → Property | |
| `code` | string | room code/label, e.g. "T002", "L101" — must be unique within a Property, not globally |
| `floor` | string/int, nullable | e.g. "Trệt", "Lầu 1", "Lầu 2" — free text is fine since floor naming varies |
| `area_sqm` | number | e.g. 26, 32 |
| `has_balcony` | boolean | |
| `price_monthly` | number (VND) | monthly rent |
| `status` | enum | see 2.5 |
| `status_updated_at` | timestamp | when status last changed — needed for audit and for "recently available" sorting |
| `sub_units` | nullable, structured or free text | some rooms are actually subdivided into smaller units with their own furniture set (e.g. a room with "2 phòng ngủ với 2 bộ nội thất riêng"). Model this as an optional array of `{ label, price_monthly?, notes }` so a Room can represent either a single unit or a small cluster of sub-units under one code. If this proves too complex for MVP, a free-text `description` field is an acceptable fallback — do not force every room into a rigid single-unit shape. |
| `amenities_override` | nullable, same shape as Property.amenities_shared | only populated when this room differs from the Property default; when null, the UI falls back to the Property's shared amenities |
| `images` | array of image URLs | photos of this specific room |
| `description` | text, nullable | free-text notes |
| `is_active` | boolean | soft-hide a room (e.g. permanently taken offline) without deleting history |
| `created_at`, `updated_at` | timestamp | |

### 2.3 Utility Fees (Property-level, versioned)

Rates can change over time (e.g. electricity price increases). Do not overwrite in place — keep history so existing tenants' contracts aren't silently reinterpreted.

```
UtilityFeeVersion {
  property_id
  electricity_price_per_kwh   // e.g. 4000
  water_price_per_person      // e.g. 100000
  service_fee_per_month       // e.g. 200000
  effective_from: date
}
```

The "current" rate for display is simply the version with the latest `effective_from` that is `<= today`.

### 2.4 Deposit Policy (Property-level)

```
DepositPolicy {
  deposit_amount           // e.g. 2,000,000 VND to hold a room
  hold_days                // e.g. 7 days
  forfeiture_rule          // free text describing what happens if the tenant doesn't return within hold_days
  contract_deposit_months  // e.g. 1 month's rent as security deposit at signing
}
```

### 2.5 Room Status (enum — fixed set, not free text)

- `available` — còn trống (default filter)
- `deposited` — đã cọc
- `sold` — đã bán / đã cho thuê dài hạn (terminology can be relabeled in UI, but keep this as a distinct state from `deposited`)
- `renovating` — đang sửa chữa

Filtering and badge coloring in the UI depend on this being a strict enum. Do not allow free-text status values.

---

## 3. Functional Requirements

### 3.1 Public Site (no login required)

**3.1.1 Landing / Listing Page**
- Displays a list of Rooms across all active Properties (or scoped to one Property if the business only ever has one — but the data model must support many).
- Each Room card shows: primary photo, Property short address, room code/floor, area, price/month, balcony indicator, status badge (color-coded), and a "Contact to view" call-to-action (tap-to-call or opens Zalo/Messenger link — no in-app form required, minimize friction).
- Default view loads all rooms across the full address list (no address filter pre-applied).
- Default status filter = `available` only, but the user can switch to see other statuses.
- Address should display the current (ward-based) address as primary, with the old (district-based) address shown as a secondary/parenthetical reference — do not make address-format a filter dimension; it's just a display concern.

**3.1.2 Filtering**
Three filter dimensions, combinable (AND logic):
1. **Address** — default: show all; filterable by Property/area once there are multiple Properties.
2. **Status** — checkboxes/tabs: Available (default-checked), Sold, Deposited, Renovating. Multi-select should be allowed (e.g. show Available + Deposited together).
3. **Price** — fixed buckets, not a slider: `< 3tr`, `3tr–<4tr`, `4tr–<5tr`, `5tr–<6tr`, `>= 6tr`. Default: show all price ranges (no bucket pre-selected). Implement server/client-side as an inclusive/exclusive numeric range query (`price >= min AND price < max`), not as a hardcoded enum, so the bucket boundaries can be changed later without a data migration.

Filters must be usable together and should update the result count live.

**3.1.3 Room Detail View**
- Full photo gallery (lightbox/carousel).
- Room-specific facts: code, floor, area, balcony, price, status, sub-units if any, description.
- Inherited/overridden amenities.
- Property-level info block: address (both formats), shared amenities, transport/convenience notes, utility fee rates (current version), deposit policy, active promotion if any.
- Prominent "Contact to arrange a viewing" action — phone number tap-to-call and/or Zalo deep link. No online payment or booking confirmation step.

**3.1.4 Responsive / Mobile**
- Single responsive web app (mobile-first), not two separate native codebases, unless a later phase explicitly calls for app-store presence.
- Should work well as a shared link opened from Zalo/Facebook/messaging apps (fast load, good default social preview/OG image).

### 3.2 Admin (authenticated)

- CRUD for Properties: create/edit all Property-level fields listed in 2.1, including adding new `UtilityFeeVersion` entries (append, don't overwrite) and editing `DepositPolicy` / `commission_policy` / `promotion`.
- CRUD for Rooms within a Property: create/edit/deactivate rooms, upload photos, edit price/area/floor/balcony/sub_units/description.
- **Fast status update**: changing a Room's status should be a 1–2 click action from the room list (e.g. inline dropdown), since this is the most frequent admin action.
- Ability to view change history is a nice-to-have, not a hard MVP requirement, except for utility fee versioning (2.3) which must be historized from day one.
- Role/access model: MVP can be single-admin-login. Note for future: the business already involves a commission split with sales agents ("chia 50/50 chủ nhà và sale"), so the schema and auth model should not make it hard to add a second role (e.g. "sales agent" with limited access) later — don't hardcode single-user assumptions into the auth layer.

### 3.3 Out of Scope for MVP

- Online payment / deposit-taking through the site.
- Automated booking confirmation or hold-timer flows (no "reserve for 15 minutes" style UX — that's an OTA pattern, not applicable here).
- Guest reviews/ratings system.
- Nightly pricing or check-in/check-out date search (this is long-term monthly rental, not hospitality).
- User accounts / login for visitors, saved favorites (visitors browse anonymously).

---

## 4. Non-Functional Requirements

- **SEO-friendly**: rooms and properties should be crawlable/indexable (server-rendered or statically generated pages), since organic search and shared links are the primary traffic source.
- **Fast on mobile networks**: images should be optimized/responsive (srcset or equivalent), initial load should not depend on heavy client-side bundles.
- **Data integrity for money-related history**: utility fee changes and (ideally) price changes should never silently overwrite past values used in existing tenant agreements.
- **i18n-ready but Vietnamese-first**: all current content is Vietnamese; no requirement for multi-language UI at this stage, but avoid hardcoding Vietnamese strings in a way that blocks future localization.

---

## 5. Suggested (Non-Binding) Tech Direction

These are suggestions, not hard constraints — an implementing AI/team may propose alternatives:

- Frontend: a server-rendered/responsive web framework (e.g. Next.js) for SEO + mobile performance, as a Progressive Web App if installability is desired later.
- Backend: a standard REST/GraphQL API service with a relational database (e.g. PostgreSQL) — the Property↔Room relationship and versioned utility fees benefit from relational integrity and transactions.
- Admin: can be a protected route within the same app, or a separate lightweight admin panel/CMS, as long as it covers the CRUD and fast-status-update needs in 3.2.

---

## 6. Open Questions (flag these back to the business owner if the implementing tool/team hits them)

1. Will the platform ever manage more than one Property under one Admin account (multi-tenant), or is it always exactly one Property per deployment? (Data model above supports multi-Property regardless, but this affects how much "Property switcher" UI is needed.)
2. Should visitors be able to see rooms with status `sold`/`deposited`/`renovating` by default, or only when they explicitly opt in via the status filter? (Current assumption: opt-in, `available` is the default.)
3. Is a second admin role (sales agent, limited permissions) needed at launch, or only "reserve room in the schema" for later?
4. Do `sub_units` (rooms split into smaller furnished units) need their own independent status/price, or do they always follow the parent Room's status/price?

---

*Reference design note: a prior interactive mockup ("Lộ Trình.vn" style OTA hotel-search demo) was reviewed for UI inspiration. Its card layout, detail-page gallery, and design tokens (colors/typography/spacing) are reusable as visual reference. Its search-by-date, online booking/checkout, and guest-review features are NOT applicable and must not be carried into this product — see Section 3.3.*

---

## 7. Addendum v2.0 — Roles, deposit lifecycle, commission/bonus, documents

This answers Open Question #3 above ("is a second admin role needed at launch") and supersedes the `deposit_policy` / `promotion` rows in the §2 tables. Implemented in `src/types/index.ts` and `src/lib/db.ts`.

### 7.1 Roles

Three parties, only two of which touch the software:

- **Customer** (khách) — anonymous public visitor. Only sees `PublicProperty`/`PublicRoom` (see `toPublicProperty`/`toPublicRoom` in `src/lib/db.ts`): no commission %, no landlord contact info, no "lì xì" bonus, no deposit-cancellation split. Every public page/API route must go through these sanitizers, never hand back a raw `Property`/`Room`.
- **Admin** (aka **Sale**) — the one logged-in role today (single shared password, see `src/lib/auth.ts`). Sees everything: commission earned, lì xì, landlord contact, full history.
- **Chủ nhà** (landlord) — a third party who never logs in. The Sale calls/Zalos them directly using `Property.landlordContactPhone` / `landlordZalo` (internal-only fields).

A dedicated "Sale" login distinct from "Admin" was not built — there is still only one password/session. If multiple sales agents need separate logins/attribution later, that is a real gap (see §7.6).

### 7.2 Deposit lifecycle (4 separate policy fields, `DepositPolicy`)

1. `holdAmount` (VND) + `holdDays` — a small fixed hold-fee to reserve a room while the customer decides. Snapshotted onto the room as `Room.currentDeposit` the moment status becomes `deposited` (via `startDeposit`), so a later edit to the property's policy never rewrites terms a customer already agreed to.
2. `securityDepositMonths` — refundable security deposit at contract signing, in months of rent (separate field).
3. `prepaidRentMonths` — months of rent prepaid at signing (separate field, not the same as #2).

Only one active deposit per room at a time — this follows room `status` directly (`available → deposited → sold`, or back to `available` on cancel/expiry), no separate "deals" table.

**Auto-expiry:** if the customer doesn't return within `holdDays`, the room automatically reverts to `available` the next time it's read (`sweepExpiredDeposits`, called from every `listRooms`/`getRoom`) and a `deposit_expired` history event is logged — landlord keeps the full hold amount, no split. The admin UI shows a live countdown (`DepositCountdown.tsx`) while `deposited`.

**Active cancellation** (customer comes back and explicitly cancels before expiry, via "Huỷ cọc" in the admin UI) uses a different formula — `calculateCancellationSettlement` in `src/lib/db.ts`:

```
dailyRate = holdAmount / holdDays
landlordCompensation = round(dailyRate × daysHeld)   // days actually held, capped at holdDays
remainder = holdAmount − landlordCompensation
saleShare = round(remainder × saleSharePercent / 100)     // depositCancellationPolicy, internal-only
landlordShare = remainder − saleShare                      // subtracted, not independently rounded, so the two always sum exactly to remainder
```

Worked example from the business owner (verified against a live test in this build): hold 2,000,000đ for 5 days → 400,000đ/day. Customer cancels on day 4 → landlord keeps 400,000 × 4 = 1,600,000 as compensation, remaining 400,000 splits 50/50 → sale 200,000 / landlord 200,000 (landlord total 1,800,000). This settlement is internal-only and must never be shown to the customer.

### 7.3 Commission vs. lì xì (kept strictly separate, both internal-only)

- **Commission** (`Property.commissionPolicy`, a `CommissionTier[]` of `{contractDurationMonths, commissionPercent}`) is computed at contract signing (`signContract` → `calculateCommission`) and shown to the Sale as both percent and VND, e.g. "50% = 3.100.000đ". **Assumption flagged in code** (`CommissionTier` doc comment): the percent applies to *one month's rent*, not the full contract value — confirm with the landlords' actual payout data if this ever looks wrong.
- **Lì xì** (`Property.saleBonusPolicy`, `SaleBonusPolicy`) is a bonus the landlord pays the sale for closing within a date window (`validFrom`/`validTo`). Computed alongside commission at contract signing. **Never shown to the customer** — confirmed explicitly by the business owner.
- The active-cancellation sale share (§7.2) is a third, separate money flow — also internal-only.

### 7.4 History / audit log (`RoomStatusEvent`, append-only, never mutated/deleted)

Every status transition is recorded in `roomStatusEvents`: plain status changes, `deposit_started`, `deposit_cancelled` (with the full settlement), `deposit_expired`, and `contract_signed` (with the full commission/bonus settlement). Visible per-room at `/admin/rooms/[id]/history`, and aggregated across all rooms at `/admin/commissions` (backed by `GET /api/commissions`) for the "hoa hồng & lì xì" report.

### 7.5 Documents (`RoomDocument`, 5 fixed types)

Upload or photo-capture support for exactly 5 paperwork types (`DOCUMENT_TYPES` in `src/types/index.ts`): giấy xác nhận cọc, hợp đồng thuê phòng, phụ phí, giấy xác nhận thanh toán hoa hồng cho sale, phụ lục hợp đồng thuê phòng. Files go through a storage path (`saveDocumentFile`/`DOCUMENTS_DIR`, served only via the admin-gated `/api/documents/file/[filename]`) that is deliberately **separate** from public room photos (`UPLOADS_DIR`, public at `/api/uploads/[filename]`) — legal/financial paperwork must never be reachable on the same unauthenticated path as a marketing photo. Managed per-room in the admin room-edit page (`RoomDocuments.tsx`).

### 7.6 Known gaps to flag before/after the "AI QC" pass

- Single shared admin password/session — no per-sale-agent login or attribution on who closed which deal (history events aren't tagged with a user, since there's only one).
- On Vercel, `DATA_DIR` points at `/tmp`, which is wiped on cold start/redeploy — fine for a short-lived demo, **not** safe once real financial/legal data (deposits, signed contracts, uploaded documents) is involved. Confirmed acceptable short-term because the plan is to move to a VPS soon, where `data/` persists normally across restarts — but this must happen before the app is used for real transactions, not after. (Superseded by §8 below — the app now runs on real MySQL/MariaDB, not this JSON file, so this specific risk no longer applies. Left here for history.)
- No automated tests; correctness of the money math above was verified manually via curl against the exact worked example the owner provided (see git history / PR description for the transcript).

## 8. Ported onto the MySQL/MariaDB backend + full QA pass (this cycle)

Two things happened in a different session/tool between the previous addendum and this one, independently of each other: (a) natural-language/nearby-radius search, exact-match city/ward dropdown filters, and admin-only extra visibility on the public pages were built on top of the *old JSON-file* store; (b) separately, the whole data layer was migrated from that JSON file to real MySQL/MariaDB (`src/lib/mysqlPool.ts`, `scripts/schema.sql`, `scripts/migrate.ts`), with money-affecting mutations now running inside a real transaction with `SELECT ... FOR UPDATE` row locking instead of the old in-process write queue. This section documents porting (a) onto (b), plus a full-codebase QA pass, all done together against the *current* MySQL-backed `db.ts` — nothing here was re-verified against the old JSON-file version, since that version is no longer what's running.

**Ported onto MySQL** (previously verified only against the JSON-file store): the Vietnamese-aware free-text search (`src/lib/search.ts`, keyword extraction unchanged, pure functions), the nearby-radius search via free OpenStreetMap Nominatim geocoding (`src/lib/geocode.ts`, unchanged, pure functions + fetch), and the `city`/`ward` exact-match dropdown filter columns on `Property`. The `city`/`ward` columns are new on a table that already existed in production, so `scripts/schema.sql` adds them via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (idempotent — safe to re-run, verified against a real MariaDB instance seeded with a pre-existing row that had neither column, confirming no data loss and the ALTER applies cleanly). `listRooms()` in `db.ts` now does city/ward exact-match filtering in SQL and keyword/radius filtering in JS against the SQL-fetched result set (the latter needs Vietnamese-aware text processing and an outbound geocoding call, neither of which belongs in SQL). Admin-only visibility (extra info shown on the public listing/detail pages to a logged-in admin, via `isAdminSession()`) ported over unchanged — it's pure React/session logic, not data-layer logic.

**Full-codebase QA pass, run directly against the MySQL-backed code**: the same 10 findings from the previous JSON-file-era QA report were re-verified and re-fixed against this codebase (money-field range validation now lives in `validatePropertyMoneyFields()` inside the MySQL `createProperty`/`updateProperty`; `calculateCommission`/`signContract` return an explicit error instead of silently defaulting to 0%; `listRooms()` gained the `includeInactiveProperties` option so admin views/reports don't lose rooms on a deactivated property; `ContractSettlement` gained the `previousDeposit` audit-trail field; document `fileUrl` is validated against this app's own storage path format; login gained a 5-attempts/15-minutes lockout keyed by client IP). See the standalone QA report delivered alongside this addendum for the full detail, including which findings were fixed vs. explicitly deferred and why.

**What's different about verifying this on MySQL vs. the old JSON-file store**: the row-locking claim (`SELECT ... FOR UPDATE` preventing two simultaneous requests from double-processing the same room) was verified with real concurrent load against a real MariaDB instance in this pass — 10 simultaneous `startDeposit` calls against the same available room produced exactly 1 success and exactly 1 `deposit_started` audit event; the same test against `signContract` on a deposited room produced exactly 1 `contract_signed` event. This is a stronger guarantee than the JSON-file version's in-process write queue ever offered once more than one Node process is involved — though note the login rate limiter and the geocode rate limiter are still in-process-only and do NOT benefit from this (see README's "Two things MySQL does NOT fix" section).
