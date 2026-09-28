# REST API Specification — Cafe Live Capacity & Seat Reservation System

Base URL: `https://api.cafeflow.app/v1`
Auth: `Authorization: Bearer <jwt>` for registered/staff/admin endpoints. Guest reservation endpoints require no token but are rate-limited by IP + phone number and protected by a short-lived `X-Session-Token` issued from `POST /public/session`.

Roles referenced below: `customer` (registered), `guest` (anonymous), `merchant`, `cashier`, `admin`, `super_admin`.

---

## 1. Auth & Session

As implemented in this package (`web/src/lib/session.ts`, `web/middleware.ts`): a signed httpOnly cookie, not JWT bearer tokens — simpler to reason about for three roles, and it's what `middleware.ts` can read on Next's Edge runtime.

### `POST /auth/login`
```json
{ "email": "cashier@cafeflow.demo", "password": "cashier123" }
```
→ `200 { "user": { "id": 2, "fullName": "Demo Cashier", "email": "...", "role": "cashier", "cafeId": 101 } }` and sets the `cf_session` cookie. `cafeId` is present for `role: "merchant" | "admin" | "cashier"` — which single cafe (`cafe_staff`) this login is scoped to; `super_admin` and `customer` omit it (unrestricted / not staff). `401 INVALID_CREDENTIALS` on a bad email/password.

### `POST /auth/logout`
Clears the session cookie. No body.

### `GET /auth/me`
→ `{ "user": SessionUser | null }` — what the current request's cookie resolves to; the frontend polls this once per page load to decide whether to show staff controls.

Route protection: `middleware.ts` redirects `/merchant/*` to `/login` unless the session role is `merchant`/`admin`, `/pos/*` unless it's `cashier`/`admin`, and `/admin/*` unless it's `super_admin`. There's no `/auth/register` endpoint — accounts are seeded directly (`database/seed.sql`) or created by a `super_admin` via section 7 below; self-serve signup for customers is a reasonable next step but wasn't asked for.

---

## 2. Discovery — Location, Search & Filters

### `GET /districts`
Manual dropdown data. `→ [{ "id": 1, "city": "Jakarta Selatan", "name": "Kebayoran Baru", "lat": -6.244, "lng": 106.799 }]`

### `GET /cafes`
Query params:

| param | type | notes |
|---|---|---|
| `lat`, `lng` | float | user's GPS coords — server ranks by Haversine distance |
| `district_id` | int | manual dropdown alternative to GPS |
| `price_tier` | `$`,`$$`,`$$$` | repeatable |
| `sort` | `popularity` \| `distance` \| `availability` | default `distance` when lat/lng present |
| `availability` | `green`\|`yellow`\|`red`\|`any` | live capacity filter |
| `q` | string | fuzzy name/address search |
| `page`, `page_size` | int | pagination |

Example: `GET /cafes?lat=-6.2297&lng=106.8075&price_tier=$$&sort=popularity&availability=green`

Response:
```json
{
  "data": [
    {
      "id": 101,
      "name": "Kopi Kina Senopati",
      "slug": "kopi-kina-senopati",
      "district": "Senopati",
      "price_tier": "$$",
      "distance_km": 1.32,
      "popularity_score": 87.4,
      "avg_rating": 4.6,
      "cover_image_url": "https://cdn.cafeflow.app/kopi-kina/cover.jpg",
      "live_capacity": {
        "occupancy_pct": 42.0,
        "color": "green",
        "tables_available": 11,
        "tables_reserved": 3,
        "tables_occupied": 6,
        "total_tables": 20
      }
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 58
}
```

Distance calculation (Haversine, server-side, mirrored client-side for optimistic sort while GPS is being fetched):

```
a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlng/2)
c = 2·atan2(√a, √(1−a))
distance_km = R · c        // R = 6371 km
```

### `GET /cafes/:id`
Full detail: hours, DP policy, slot length, floors summary, `live_capacity` (same shape as above, recomputed from `cafe_live_capacity` view / cache).

### `GET /cafes/:id/capacity` — polled every 5–10s by the landing/detail page
```json
{ "cafe_id": 101, "occupancy_pct": 61.0, "color": "yellow", "tables_available": 8, "tables_reserved": 4, "tables_occupied": 8, "updated_at": "2026-09-12T09:31:04Z" }
```
In production this is backed by a Redis-cached rollup invalidated on every `tables` status write and pushed over WebSocket/SSE (`GET /cafes/:id/capacity/stream`) rather than pure polling.

---

## 3. Floor Plan — Merchant Builder

Both write endpoints below require a `merchant`/`admin` session (`requireStaffSession` in `web/src/lib/staffAuth.ts`) scoped to the target cafe — `POST /merchant/floors` checks the `cafeId` in the body, `PUT /merchant/floors/:floorId/layout` resolves the floor's actual cafe first and rejects with `403 FORBIDDEN` on a mismatch. A `merchant`/`admin` session's `cafeId` comes from `cafe_staff` (see section 1); only `super_admin` bypasses this.

### `GET /merchant/cafes/:cafeId/floors`
→ list of floors with nested tables (used to hydrate the drag-and-drop canvas). Each floor carries a `level` (building floor: 1, 2, 3…) in addition to `zone_type` (indoor/outdoor/smoking) — the UI groups by level first, then by zone within it.

### `POST /merchant/floors` — add a building level or zone
```json
{ "cafeId": 101, "name": "Rooftop", "zoneType": "outdoor", "level": 2 }
```
→ `201` with the created floor (empty `tables: []`). The builder calls this immediately when "Add floor level" or "+zone" is clicked, so every floor the canvas shows already has a real id before any table is saved to it.

### `PUT /merchant/floors/:floorId/layout` — save custom layout
Merchant role only. Full replace-on-save payload; server diffs against existing `tables` rows (upsert by `table_code`, soft-delete removed ones).

```json
{
  "floor": { "name": "Main Hall", "zone_type": "indoor", "canvas_width": 1000, "canvas_height": 700 },
  "tables": [
    { "table_code": "A1", "shape": "round",     "x": 120, "y": 80,  "width": 80, "height": 80,  "rotation": 0,  "capacity": 4 },
    { "table_code": "A2", "shape": "square",    "x": 240, "y": 80,  "width": 90, "height": 90,  "rotation": 0,  "capacity": 2 },
    { "table_code": "OUT-1", "shape": "rectangle", "x": 40, "y": 420, "width": 140, "height": 70, "rotation": 90, "capacity": 6 }
  ]
}
```

Response echoes back persisted rows with generated IDs:
```json
{
  "floor_id": 12,
  "tables": [
    { "id": 501, "table_code": "A1", "layout_meta": { "x": 120, "y": 80, "w": 80, "h": 80, "shape": "round", "rotation": 0 }, "capacity": 4, "status": "available" }
  ]
}
```

### `DELETE /merchant/tables/:tableId`
Soft-deletes a table (`is_active = false`); blocked with `409` if it has active reservations.

---

## 4. Reservation Flow

### `POST /reservations` — guest or registered
```json
{
  "cafe_id": 101,
  "table_id": 507,
  "party_size": 3,
  "slot_minutes": 90,
  "start_time": "2026-09-12T19:00:00+07:00",
  "guest": { "name": "Bunga Larasati", "whatsapp": "+6281299887766" }
}
```
For a registered user, omit `guest` and send the bearer token instead — `user_id` is inferred.

Server logic:
1. Validate table is `available` for the requested `[start_time, start_time + slot_minutes)` window (DB exclusion constraint is the final guard against races).
2. Create `reservations` row with `status = pending_payment`, `qr_code_token` generated, table flipped to `reserved` optimistically pending payment.
3. If `cafes.requires_down_payment`, create a `payments` row (`status = pending`, `hold_expires_at = now() + dp_hold_minutes`) and return a payment intent.
4. If no DP required, skip straight to step "confirm" below.

Response:
```json
{
  "reservation_id": 9931,
  "reservation_code": "RSV-3F7A21C9",
  "status": "pending_payment",
  "payment": {
    "id": 5510,
    "amount": 25000,
    "currency": "IDR",
    "method_options": ["qris", "virtual_account", "ewallet"],
    "hold_expires_at": "2026-09-12T11:52:00Z"
  }
}
```

### `POST /payments/:paymentId/confirm` — payment gateway webhook (simulated)
```json
{ "external_ref": "QRIS-88213", "status": "paid", "paid_at": "2026-09-12T11:44:12Z" }
```
On success: reservation → `confirmed`, `confirmed_at` set, QR ticket rendered, and two async jobs enqueued into `notification_logs`:
* `channel: whatsapp, type: qr_ticket` — sent immediately
* `channel: whatsapp, type: reminder_h1` — `scheduled_for = start_time - interval '1 hour'`

If the 10-minute hold lapses unpaid, a scheduled job flips `payments.status = expired`, `reservations.status = expired`, and the table reverts to `available`.

### `GET /reservations/:code` — customer-facing ticket lookup (guest-safe, code-based)
```json
{
  "reservation_code": "RSV-3F7A21C9",
  "status": "confirmed",
  "cafe": { "name": "Kopi Kina Senopati", "address": "Jl. Senopati No. 45" },
  "table_code": "A4",
  "party_size": 3,
  "start_time": "2026-09-12T19:00:00+07:00",
  "end_time": "2026-09-12T20:30:00+07:00",
  "qr_payload": "cafeflow://ticket/8f2c1a...",
  "grace_period_minutes": 15
}
```

### `POST /reservations/:id/cancel`
Guest must supply matching `whatsapp` + `reservation_code`; registered users are authenticated by token. Reverts table to `available`, triggers `cancellation` WhatsApp notification.

### System job: grace-period auto-cancel
Every minute, a scheduler flips any `confirmed` reservation whose `start_time + grace_period_minutes < now()` and never checked in to `no_show`, releasing the table.

---

## 5. Cashier POS

Every endpoint below requires a `cashier`/`admin` session (`requireStaffSession` in `web/src/lib/staffAuth.ts`). Both roles are scoped to exactly one `cafeId` (see section 1) — every route re-derives the table's actual cafe from the DB and rejects with `403 FORBIDDEN` if it doesn't match the session's `cafeId`, so neither a cashier nor an admin can act on another cafe's tables even by guessing ids. Only `super_admin` carries no cafe restriction (and doesn't sign in to POS at all — it's not in the allowed role list here).

### `GET /pos/cafes/:cafeId/tables` — live board for the POS grid
```json
[
  { "table_id": 507, "table_code": "A4", "floor": "Main Hall", "status": "reserved",
    "current_reservation": { "id": 9931, "guest_name": "Bunga Larasati", "party_size": 3, "start_time": "2026-09-12T19:00:00+07:00" } },
  { "table_id": 508, "table_code": "A5", "floor": "Main Hall", "status": "available", "current_reservation": null }
]
```

### `POST /pos/checkin` — QR scan or manual code entry
```json
{ "qr_payload": "cafeflow://ticket/8f2c1a...", "cashier_id": 7 }
```
→ marks reservation `checked_in`, table `occupied`, logs `table_status_logs(action = check_in_qr)`.

### `POST /pos/tables/:tableId/status` — instant manual toggle
```json
{ "action": "walk_in_seat", "party_size": 2, "cashier_id": 7 }
```
Actions: `check_in_manual`, `walk_in_seat`, `checkout`, `mark_available`, `mark_occupied`, `mark_reserved`, `mark_maintenance`. Each call is one row in `table_status_logs` for audit + is broadcast over the cafe's WebSocket room so every POS terminal and every customer viewing the floor plan updates within ~1s.

### `POST /pos/tables/:tableId/checkout`
Closes the active reservation (`status = completed`, `completed_at = now()`), table → `available`.

---

## 5B. Menu (public reads, cashier/admin writes)

### `GET /cafes/:id/menu` — public
→ `{ "data": MenuItem[] }`, ordered by category then `sort_order`.

### `POST /cafes/:id/menu` · `PATCH /cafes/:id/menu/:itemId` · `DELETE /cafes/:id/menu/:itemId`
Staff-only. Requires a valid `cashier`/`admin` session cookie (`web/src/lib/staffAuth.ts`, same session `/auth/login` sets); returns `403 STAFF_ONLY` without one.
```json
{ "name": "Cappuccino", "price": 32000, "category": "Coffee", "description": "Double shot espresso, steamed milk." }
```

### `POST /cafes/:id/menu-document` — staff-only, `multipart/form-data`
Field `file`: PDF, PNG, JPG or WEBP, ≤8MB. Stores it outside `public/` and serves it back through `GET /uploads/menus/:filename` (a normal dynamic route) so it's viewable immediately — Next's `public/` folder snapshots its file list once at server boot, so anything written there mid-process 404s until a restart. Response:
```json
{ "menuDocumentUrl": "/api/uploads/menus/cafe-101-menu-1234.png", "menuDocumentType": "image" }
```

---

## 6. Notification Engine (simulation)

### `POST /notifications/dispatch` — internal, called by the reservation/payment/scheduler services
```json
{ "reservation_id": 9931, "channel": "whatsapp", "type": "qr_ticket", "recipient": "+6281299887766" }
```
The simulated WhatsApp adapter logs the outbound payload (formatted message + QR image URL) to `notification_logs` with `status: sent` and a fake `provider_message_id`; swapping in the real WhatsApp Cloud API only touches this one adapter.

### `GET /notifications/me` — registered users, in-app push feed
```json
[{ "type": "reminder_h1", "title": "Table A4 in 1 hour", "body": "See you at Kopi Kina Senopati at 19:00.", "sent_at": "2026-09-12T18:00:03Z" }]
```

---

## 7. Super Admin — cafes + per-cafe staff accounts

As implemented (`web/src/app/api/admin/**`, gated by `requireSuperAdmin` — session role must be `super_admin`): `super_admin` is the only platform-wide role. It can create new cafes and activate/deactivate any cafe, and create/manage the merchant, admin, and cashier logins for any cafe — every one of those three roles is scoped to exactly one cafe via `cafe_staff(cafe_id, user_id UNIQUE)`. `cafes.merchant_user_id` still exists but is legacy/display-only now; `cafe_staff` is what authorization actually reads.

### `GET /admin/cafes` — cafe picker
→ `{ "data": [{ "id": 101, "name": "Kopi Kina Senopati", "isActive": true }, ...] }`

### `POST /admin/cafes` — create a cafe
```json
{ "name": "New Cafe", "districtId": 1, "address": "Jl. ...", "latitude": -6.2, "longitude": 106.8, "whatsappNumber": "+62812345678" }
```
→ `201` with `{ "data": { "id": 107, "name": "New Cafe" } }`. Slug is auto-derived from the name (numeric suffix on collision). The cafe starts with no staff assigned — follow up with `POST /admin/cafes/:cafeId/staff` below. `optional priceTier` (`"$"`/`"$$"`/`"$$$"`, defaults `"$$"`) and `description`.

### `PATCH /admin/cafes/:cafeId` — activate / deactivate a cafe
```json
{ "isActive": false }
```

### `GET /admin/cafes/:cafeId/staff` — merchant/admin/cashier accounts for one cafe
→ `{ "data": [{ "id": 2, "fullName": "Demo Cashier", "email": "cashier@cafeflow.demo", "role": "cashier", "isActive": true, "createdAt": "..." }] }`

### `POST /admin/cafes/:cafeId/staff` — create an account scoped to this cafe
```json
{ "fullName": "New Cashier", "email": "cashier2@cafeflow.demo", "password": "at-least-6-chars", "role": "cashier" }
```
`role` is one of `merchant` / `admin` / `cashier`. → `201` with the created account, or `409 EMAIL_TAKEN` / `404 NOT_FOUND` (bad `cafeId`) / `400 INVALID_BODY` (missing fields or invalid `role`).

### `PATCH /admin/staff/:userId` — rename, reset password, or reactivate
```json
{ "fullName": "...", "password": "...", "isActive": true }
```
All fields optional; only the ones present are updated.

### `DELETE /admin/staff/:userId` — deactivate
Soft-delete only (`users.is_active = false`) — a hard delete would break the `table_status_logs.cashier_id` FK and erase who checked which guest in/out. A deactivated account can no longer log in; reactivate it via the `PATCH` above instead of recreating it.

Platform-wide metrics/notification-log dashboards across all cafes weren't asked for and aren't implemented — only the cafe + staff-account CRUD above.

---

## Error shape (all endpoints)
```json
{ "error": { "code": "TABLE_ALREADY_RESERVED", "message": "This table was just booked by someone else. Please pick another.", "status": 409 } }
```

## Realtime channel
`wss://api.cafeflow.app/v1/ws/cafes/:id` broadcasts `{ "event": "table.status_changed", "table_id": 507, "status": "occupied" }` and `{ "event": "capacity.updated", ... }` — the floor plan viewer, landing page cards, and POS grid all subscribe to the same event stream so no view is ever stale by more than a network round trip.
