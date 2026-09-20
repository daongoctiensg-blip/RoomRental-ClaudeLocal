# Room Rental Listing — Public Site + Admin

A responsive (mobile-first) website for listing rooms for rent within one or more
Properties. Visitors can filter by address, status, and price, and contact the
owner directly (call/Zalo) to arrange a viewing. The owner manages Properties and
Rooms through a password-protected `/admin` area.

Built with Next.js (App Router) + TypeScript + Tailwind CSS.

See `docs/requirements.md` for the full product requirements this app implements.

## Data storage: MySQL/MariaDB

`src/lib/db.ts` talks to a real MySQL-compatible database (MariaDB works
identically — same protocol, same `mysql2` driver) via `src/lib/mysqlPool.ts`.
Schema is in `scripts/schema.sql`; a hybrid design — real columns for anything
filtered/sorted (status, price, foreign keys, timestamps), JSON columns for
the nested/variable-shape data that maps 1:1 to the TypeScript types in
`src/types/index.ts` (amenity lists, deposit/commission/bonus policies, event
payloads). All money-affecting mutations (deposit start/cancel, contract
signing, the auto-expiry sweep) run inside a transaction with `FOR UPDATE`
row locking, so two simultaneous requests can never double-process the same
room.

### First-time setup (or moving to a fresh database)

1. Create a database + user (MySQL/MariaDB is usually already installed on
   the VPS — check with `mysqladmin ping` before installing anything new):
   ```sql
   CREATE DATABASE phongchothue CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'phongchothue'@'localhost' IDENTIFIED BY '<a real password>';
   GRANT ALL PRIVILEGES ON phongchothue.* TO 'phongchothue'@'localhost';
   FLUSH PRIVILEGES;
   ```
2. Add `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` to `.env` (see
   `.env.example`).
3. Run `npm run db:migrate` — creates the tables (`CREATE TABLE IF NOT
   EXISTS`, never drops/alters anything) and seeds the initial property/rooms
   from `src/lib/seed.ts` **only if the `properties` table is completely
   empty**. Safe to re-run any time; it will never duplicate or overwrite
   real data.
4. `npm run build && npm run start` (or restart via pm2) as usual.

Uploaded files (room photos, admin documents) still live on disk under
`data/uploads` / `data/documents` — only the *records about* them moved to
the database, not the file bytes themselves.

### Backups

Everything that matters is in MySQL now — back up with `mysqldump` (plus the
`data/uploads` and `data/documents` folders for the actual files) instead of
copying `data/db.json`, which no longer exists once you've migrated.

### Two things MySQL does NOT fix: single-process in-memory rate limiters

Moving to MySQL solved the JSON-file store's biggest limitation (the
in-process write queue that couldn't be shared across multiple app
instances). But two separate safety mechanisms elsewhere in the codebase
have the exact same "single process only" constraint, and MySQL has nothing
to do with either of them — they hold their state in a plain in-memory `Map`
inside the Node process, not in the database:

- `src/lib/geocode.ts` — the outbound-request rate limiter that throttles
  calls to the free Nominatim geocoding API used by the search box's
  nearby-radius matching (`MIN_REQUEST_INTERVAL_MS`). With N app processes
  each running their own limiter, the real outbound rate to Nominatim
  becomes N× what any single process intends, risking an IP ban.
- `src/lib/auth.ts` — the login rate limiter/lockout guarding the shared
  `ADMIN_PASSWORD` (`loginAttempts` map, 5 failed attempts / 15 minutes).
  With N processes behind a load balancer, an attacker's requests get spread
  across processes and each one only sees a fraction of the failed
  attempts — the allowed guess rate effectively multiplies by N.

**Do not run this app as multiple instances/replicas/pm2-cluster workers
without replacing both of these with a shared store (e.g. Redis) first.**
Single-instance deployment (the current plan) is unaffected by either
caveat.

## Environment variables

Copy `.env.example` to `.env.local` for local development (or `.env` on the
VPS) and set real values:

```
ADMIN_PASSWORD=<a real password>
SESSION_SECRET=<a long random string, e.g. output of `openssl rand -hex 32`>
```

`ADMIN_PASSWORD` gates the `/admin` login. `SESSION_SECRET` signs the admin
session cookie — anyone who knows it could forge a valid admin session, so
treat it like a password too.

## Running locally

```bash
npm install
cp .env.example .env.local   # then edit the values
npm run dev
```

Open http://localhost:3000 for the public site, and http://localhost:3000/admin
for the admin login.

## Deploying to a VPS

```bash
npm install
npm run build
npm run start   # serves on port 3000 by default; put behind nginx/caddy for TLS
```

Make sure `.env` (with `ADMIN_PASSWORD` and `SESSION_SECRET` set) is present
next to the app on the server, and that the process has write access to the
`data/` directory (or wherever you point `DB_PATH` if you change it) so it can
persist admin edits.

Because `data/db.json` is the only persistent state right now, **back it up**
(cron + copy to another disk/bucket is enough at this scale) until you migrate
to a real database.

## Project structure

```
src/
  types/index.ts       Domain types (Property, Room, RoomStatus, etc.) — the schema
  lib/
    db.ts              JSON-file data layer — swap internals for a real DB later
    seed.ts            Initial sample data (based on the owner's real property)
    auth.ts            Admin session cookie signing/verification
    apiAuth.ts          requireAdmin() guard used by admin-only API routes
    format.ts          VND currency + tel:/Zalo link helpers
    priceBuckets.ts     The 5 fixed price filter buckets from the PRD
  app/
    page.tsx            Public listing page (filters: address, status, price)
    rooms/[id]/page.tsx Public room detail page
    admin/
      login/page.tsx     Admin login form
      (dashboard)/       Auth-gated: dashboard, property/room create+edit forms
    api/                 REST endpoints backing both the public site and admin
  components/           Shared UI (RoomCard, FilterBar, forms, etc.)
```

## What's intentionally NOT built (see PRD §3.3)

- No online payment / booking confirmation flow — contact is call/Zalo only.
- No guest reviews/ratings.
- No nightly/date-range search — this is long-term monthly rental.
- No visitor accounts or saved favorites.

## Roles, deposits, commission & documents (v2)

The app now distinguishes three parties — see `docs/requirements.md` §7 for
the full spec:

- **Customer** — public visitor, only ever sees the sanitized `PublicProperty`/
  `PublicRoom` shape (`toPublicProperty`/`toPublicRoom` in `src/lib/db.ts`):
  no commission, no landlord contact, no "lì xì", no cancellation split.
- **Admin (Sale)** — the one logged-in role; sees everything, including
  commission (`% và số tiền`), lì xì, landlord contact, and full history.
- **Chủ nhà (landlord)** — never logs in; Sale reaches them via
  `Property.landlordContactPhone`/`landlordZalo` (internal-only fields).

Deposit is a 4-field policy (`DepositPolicy`) with a live countdown while a
room is `deposited`, auto-reverting to `available` on expiry, and a distinct
50/50-style settlement formula for an *active* cancellation (see
`calculateCancellationSettlement`). Every status change is logged to an
append-only history (`/admin/rooms/[id]/history`), and commission + lì xì are
aggregated at `/admin/commissions`. Legal/financial documents (5 fixed types)
upload through `/api/documents/upload` and are served only to logged-in
admins at `/api/documents/file/[filename]` — a separate, auth-gated path from
public room photos (`/api/uploads/[filename]`).

## Known limitations to revisit

- Single shared admin password/session — no per-sale-agent login, so history
  events aren't attributed to a specific person.
- On Vercel, `DATA_DIR` resolves to `/tmp`, which does not survive a cold
  start or redeploy. That's an acceptable short-term risk for a demo, but
  **not** once real deposits/contracts/documents are involved — this needs a
  VPS (where `data/` persists normally) or a real database before relying on
  it for actual transactions.
