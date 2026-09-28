# CafeFlow — Real-Time Cafe Live Capacity & Seat Reservation System

A complete, production-shaped implementation covering all three roles (Customer, Merchant/Cashier, Platform Admin) end to end: a real PostgreSQL database, a REST API, and a fully interactive Next.js + Tailwind front end.

## What's in this package

```
cafe-system/
├── database/
│   ├── schema.sql          PostgreSQL DDL — roles, users, districts, cafes, floors
│   │                        (with building `level` + zone_type), tables, reservations,
│   │                        payments, menu_items, notification_logs, plus a live-capacity
│   │                        view and a double-booking guard.
│   └── seed.sql             Demo data (6 cafes, 4 Jakarta districts, floors + tables) —
│                            optional, but the app looks empty without it.
├── docs/
│   └── API_SPEC.md         Full REST API reference with sample JSON payloads for
│                            every flow: discovery/search, floor layout save,
│                            reservation + DP payment hold, POS actions, notifications.
└── web/                    Runnable Next.js 14 (App Router) + TypeScript + Tailwind app,
                             backed by real Postgres via `pg` (see web/src/lib/store.ts).
```

## 1. Set up the database

Any Postgres works — a free [Neon](https://neon.tech) or [Supabase](https://supabase.com) project, or a local instance. You need a connection string that looks like:

```
postgresql://user:password@host/dbname?sslmode=require
```

Apply the schema and seed data. If you have `psql` and can reach the database directly:

```bash
psql "<your connection string>" -f database/schema.sql
psql "<your connection string>" -f database/seed.sql
```

If you're on Neon/Supabase's web dashboard instead (no local `psql`, or your network can't reach the DB directly): open the dashboard's **SQL Editor**, paste the contents of `database/schema.sql`, run it, then paste `database/seed.sql` and run that too. Both files are idempotent-ish: `schema.sql` uses `CREATE ... IF NOT EXISTS` where possible, and `seed.sql` clears its own demo rows before re-inserting, so re-running either is safe.

## 2. Configure and run the app

```bash
cd web
cp .env.example .env.local
# edit .env.local: paste your connection string into DATABASE_URL,
# and set SESSION_SECRET to a random string (used to sign login sessions).

npm install
npm run dev        # http://localhost:3000
```

`npm run build && npm run start` runs the production build. Both were verified end-to-end against a real Postgres instance (schema apply → seed → search → reserve → pay DP → notifications → POS QR check-in → floor layout save), with zero TypeScript errors.

**Without `DATABASE_URL` set, the app will not start** — `web/src/lib/db.ts` fails fast with a clear error naming the missing env var, rather than silently falling back to fake data.

## Screens

| Route | Role | What it does |
|---|---|---|
| `/` | Customer (guest or registered) | GPS/district search, price + live-availability filters, sort by popularity/distance/availability |
| `/cafe/[id]` | Customer | Live floor plan (color-coded by table status, grouped by building floor level then zone), reservation flow (party size → time slot → guest/registered → DP payment countdown → QR ticket), and a menu section (items + a PDF/photo of the full menu) below the seating |
| `/merchant/builder` | Merchant/Admin (login required) | Drag-and-drop floor plan designer — add building floor levels ("Lantai 1/2/…") and zones (Indoor/Outdoor/Smoking) within each, add/move/rotate tables, edit capacity, save layout |
| `/pos` | Cashier/Admin (login required) | Live table grid, tap-to-act quick panel (check-in, walk-in, checkout, maintenance), simulated QR ticket scanner. A cashier's board is always their own assigned cafe — no cafe picker, no way to reach anyone else's tables. |
| `/admin` | Super Admin (login required) | Add new cafes, and create/deactivate/reactivate merchant, admin, and cashier login accounts — each one scoped to a single cafe you pick. |
| `/login` | Everyone | Email/password sign-in; redirects to the right area for the account's role (see demo accounts below) |

## Adding a new cafe (and giving it a seating plan)

A cafe created via `/admin` starts with no floors, no tables, and no staff — three short steps to get it fully working:

1. **`/admin`** (as `super_admin`) → "New cafe" → fill name/district/address/lat-long/WhatsApp → create.
2. On the same page, pick that cafe → "New account" → create a `merchant` (or `admin`) login for it. That account is now scoped to this one cafe (`cafe_staff`).
3. Log out, log back in as that new merchant/admin account → **`/merchant/builder`** now opens on this cafe (empty) → "Add floor level" bootstraps "Lantai 1" → "+indoor/outdoor/smoking" adds zones within it → drag in tables from "Add table", set capacity/shape, "Save layout". Repeat "Add floor level" for more floors.

That layout shows up immediately on the cafe's public page (`/cafe/[id]`) and is what `/pos` (once a cashier account exists for that cafe, same step 2) reads and writes to.

## Design choices worth knowing about

* **Capacity color bands** (green < 50%, yellow 50–85%, red > 85%) are computed live from `tables.status` via the `cafe_live_capacity` SQL view, not from a cached reservation count, so a cashier's check-in/checkout tap is reflected everywhere within one poll cycle (landing cards, floor plan, POS grid all read the same source of truth).
* **Double-booking is blocked at the database layer** via a Postgres `EXCLUDE` constraint on `reservations(table_id, tstzrange(start_time, end_time))`, in addition to a `SELECT ... FOR UPDATE` row lock in the reservation transaction — two guests racing to book the same table/slot can't both succeed even under concurrent writes. `web/src/lib/store.ts`'s `createReservation` catches the constraint violation (Postgres error code `23P01`) and turns it into a clean `409 TABLE_ALREADY_RESERVED`.
* **BIGINT ids are parsed back to JS numbers** at the driver level (`web/src/lib/db.ts`) — `pg` returns `bigint` columns as strings by default (to avoid silent precision loss above 2^53), which would otherwise break every `===` comparison on table/reservation ids in the React state.
* **The 10-minute DP hold and 15-minute grace period** are both modeled as real timestamp fields (`payments.hold_expires_at`, reservation start + `grace_period_minutes`) — the UI's countdown timer reads the same deadline the backend enforces. A scheduled job to auto-expire lapsed holds/grace periods is described in `docs/API_SPEC.md` but not included as a running worker in this package.
* **Notification simulation**: every WhatsApp/push send is logged to `notification_logs` with the rendered message and a fake provider status, so swapping in the real WhatsApp Cloud API only touches one function (`logNotification` in `store.ts`), never the reservation/payment logic that triggers it.
* **QR tickets use the database-generated `qr_code_token`** (a random 32-char hex string via `gen_random_bytes(16)`), never the internal reservation id — so a scanned/guessed ticket can't be used to enumerate other reservations.
* **Real per-role login** (`/login`, `web/src/lib/session.ts`) gates the merchant, cashier and admin areas: `middleware.ts` redirects `/merchant/*`, `/pos/*` and `/admin/*` to `/login` unless the signed session cookie has the right role, and the menu-editing endpoints (`web/src/lib/staffAuth.ts`) check the same session instead of a shared PIN. Sessions are a signed cookie (HMAC over a small JSON payload, Web Crypto so it also runs in `middleware.ts`'s Edge runtime), not a database-backed session store or a real auth provider — good enough for a handful of demo roles, worth swapping out before real customer accounts are at stake. Demo logins (seeded in `database/seed.sql`): `superadmin@cafeflow.demo` / `superadmin123`, `merchant@cafeflow.demo` / `merchant123`, `cashier@cafeflow.demo` / `cashier123`, `admin@cafeflow.demo` / `admin123`, `fachri@privy.id` / `customer123`.
* **Every staff role — merchant, admin, and cashier — is scoped to exactly one cafe**, not just cashier. `database/schema.sql`'s `cafe_staff` table maps one login to one cafe (`user_id` is `UNIQUE`), replacing the old `cafes.merchant_user_id`-only model — that column still exists for legacy/display purposes but is no longer what authorization reads. Only `super_admin` is unrestricted across cafes. A staff session carries its `cafeId`, and `web/src/lib/staffAuth.ts`'s `requireStaffSession` + `assertCafeMatch` re-check that `cafeId` server-side on every write: the floor plan builder (`/api/merchant/floors*`), menu editing (`/api/cafes/[id]/menu*`), and the POS board (`/api/pos/*`) all reject a request whose target cafe doesn't match the session's — so a merchant, admin, or cashier account can never act on another cafe's data, even by guessing table/floor/item/cafe ids in the request.
* **`super_admin` is the only platform-wide role** — it can create new cafes, activate/deactivate any cafe, and create/deactivate/reactivate a merchant, admin, or cashier account for any cafe, all from `/admin` (`GET/POST /api/admin/cafes`, `PATCH /api/admin/cafes/:cafeId`, `GET/POST /api/admin/cafes/:cafeId/staff`, `PATCH/DELETE /api/admin/staff/:userId`). A new cafe's slug is auto-derived from its name (with a numeric suffix on collision) and it starts with no staff assigned — the super admin adds those right after.
* **The reservation endpoint derives the signed-in user from the session cookie, never from the request body** — an earlier version trusted a client-supplied `userId`, which meant anyone could POST a reservation "as" another account by just naming its id.
* **Uploaded menu PDFs/photos are served from `web/src/app/api/uploads/menus/[filename]/route.ts`, not `public/`** — Next.js snapshots `public/`'s file list once at server boot, so a file written there while the server is already running 404s until the next restart. Serving through a normal dynamic route reads from disk on every request instead, so an upload is viewable immediately.
* **Live-data polling is intentionally light and pauses when the tab is hidden** (`web/src/lib/usePolling.ts`): landing cards refresh every 45s, a cafe's floor plan every 20s, the POS grid every 12s — enough to feel live without hammering the server once this is deployed for real traffic.

## Troubleshooting

* **"DATABASE_URL is not set"** — copy `web/.env.example` to `web/.env.local` and fill in your connection string.
* **Connection refused / timeout** — most managed Postgres (Neon, Supabase) require `?sslmode=require` in the connection string; make sure it's there.
* **Empty landing page / no cafes** — you applied `schema.sql` but not `seed.sql`. Run it (see step 1).
