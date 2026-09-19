# Room Rental Listing — Public Site + Admin

A responsive (mobile-first) website for listing rooms for rent within one or more
Properties. Visitors can filter by address, status, and price, and contact the
owner directly (call/Zalo) to arrange a viewing. The owner manages Properties and
Rooms through a password-protected `/admin` area.

Built with Next.js (App Router) + TypeScript + Tailwind CSS.

See `docs/requirements.md` for the full product requirements this app implements.

## Current data storage: JSON file (temporary, by design)

Per the project's current stage, there is **no real database yet**. All data
lives in a single JSON file at `data/db.json`, read/written through
`src/lib/db.ts`. That file is created automatically (from the seed data in
`src/lib/seed.ts`) the first time the app runs, if it doesn't already exist.

This is intentional and safe to run in production short-term, but it has real
limits worth knowing before relying on it for long:

- It works fine for one Node process. If you ever run multiple instances behind
  a load balancer, they will NOT share writes correctly.
- No proper concurrent-transaction safety — `src/lib/db.ts` serializes writes
  within one process (a write queue), which prevents corruption from
  simultaneous admin edits, but it's not a substitute for real ACID transactions.
- The whole database is one file — back it up (`data/db.json`) regularly.

### Migrating to a real database later

When you're ready to move to Postgres/MySQL/etc. on the VPS:

1. The types in `src/types/index.ts` are the schema — they already match the
   PRD's data model, including the versioned `utilityFeeVersions` (so past
   rates are never overwritten) and the `RoomStatus` enum.
2. Every read/write in the app goes through the functions exported by
   `src/lib/db.ts` (`listRooms`, `getRoom`, `createRoom`, `updateRoom`,
   `setRoomStatus`, `listProperties`, `getProperty`, `createProperty`,
   `updateProperty`, `addUtilityFeeVersion`, etc.).
3. To swap the backend, rewrite the *internals* of those functions to talk to
   your real database instead of `data/db.json`, but keep the same function
   names and return types. Nothing in `src/app/**` or `src/components/**`
   needs to change.
4. A reasonable schema to create in the real database is one table per
   top-level type (`properties`, `rooms`, `utility_fee_versions`) with
   `rooms.property_id` and `utility_fee_versions.property_id` as foreign keys —
   this mirrors the JSON shape closely.

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
