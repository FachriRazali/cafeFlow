-- ============================================================================
-- Real-Time Cafe Live Capacity & Seat Reservation System
-- PostgreSQL Database Schema (DDL)
-- ============================================================================
-- Conventions:
--   * Surrogate keys are BIGINT GENERATED ALWAYS AS IDENTITY (fast, sortable,
--     cheaper to index than UUID). Public-facing codes (reservation_code,
--     qr_code_token) are separate opaque strings so internal IDs are never
--     leaked to the client.
--   * All timestamps are TIMESTAMPTZ, stored in UTC, rendered in the
--     client's local timezone (Asia/Jakarta by default for this product).
--   * updated_at columns are maintained by the trg_set_updated_at trigger.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid() for public tokens
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- fuzzy search on cafe name / address
CREATE EXTENSION IF NOT EXISTS citext;        -- case-insensitive users.email — must exist before `users` is created
CREATE EXTENSION IF NOT EXISTS btree_gist;     -- powers the anti-double-booking EXCLUDE constraint on `reservations`

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
CREATE TYPE role_code            AS ENUM ('super_admin', 'admin', 'merchant', 'cashier', 'customer');
CREATE TYPE price_tier           AS ENUM ('$', '$$', '$$$');
CREATE TYPE zone_type            AS ENUM ('indoor', 'outdoor', 'smoking');
CREATE TYPE table_shape          AS ENUM ('round', 'square', 'rectangle', 'sofa', 'bar');
CREATE TYPE table_status         AS ENUM ('available', 'reserved', 'occupied', 'maintenance');
CREATE TYPE reservation_source   AS ENUM ('guest', 'registered', 'walk_in');
CREATE TYPE reservation_status   AS ENUM (
  'pending_payment',  -- DP invoice created, 10-minute hold ticking
  'confirmed',        -- DP paid (or no-DP cafe), QR ticket issued
  'checked_in',       -- guest scanned in at cashier POS
  'completed',        -- checkout done
  'cancelled',         -- cancelled by guest/merchant
  'expired',           -- 10-min payment hold or 15-min grace period lapsed
  'no_show'
);
CREATE TYPE payment_type         AS ENUM ('down_payment', 'full_payment', 'refund');
CREATE TYPE payment_method       AS ENUM ('qris', 'virtual_account', 'ewallet', 'credit_card', 'cash');
CREATE TYPE payment_status       AS ENUM ('pending', 'paid', 'expired', 'failed', 'refunded');
CREATE TYPE notification_channel AS ENUM ('whatsapp', 'push', 'sms', 'email');
CREATE TYPE notification_type   AS ENUM (
  'booking_confirmation', 'qr_ticket', 'reminder_h1', 'payment_hold_warning',
  'payment_confirmed', 'cancellation', 'checked_in', 'admin_alert'
);
CREATE TYPE notification_status  AS ENUM ('queued', 'sent', 'delivered', 'failed');
CREATE TYPE cashier_action       AS ENUM (
  'check_in_qr', 'check_in_manual', 'walk_in_seat', 'checkout',
  'mark_available', 'mark_occupied', 'mark_reserved', 'mark_maintenance'
);

-- ----------------------------------------------------------------------------
-- helper: generic updated_at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. ROLES & USERS
-- ============================================================================
CREATE TABLE roles (
  id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        role_code NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (code, label) VALUES
  ('super_admin', 'Platform Super Admin'),          -- the only role not bound to a single cafe
  ('admin', 'Cafe Admin'),                          -- scoped to one cafe via cafe_staff, like merchant/cashier
  ('merchant', 'Cafe Owner / Merchant'),            -- scoped to one cafe via cafe_staff
  ('cashier', 'Cafe Cashier / Staff'),               -- scoped to one cafe via cafe_staff
  ('customer', 'Registered Customer');

CREATE TABLE users (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id         SMALLINT NOT NULL REFERENCES roles(id),
  full_name       TEXT NOT NULL,
  email           CITEXT UNIQUE,
  phone_number    TEXT UNIQUE,                 -- E.164, e.g. +6281234567890
  whatsapp_number TEXT,
  password_hash   TEXT,                        -- NULL allowed for SSO/guest-derived accounts
  avatar_url      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ============================================================================
-- 2. DISTRICTS (Kecamatan) — used for manual dropdown search
-- ============================================================================
CREATE TABLE districts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  province    TEXT NOT NULL,
  city        TEXT NOT NULL,
  name        TEXT NOT NULL,               -- Kecamatan name
  latitude    NUMERIC(9,6) NOT NULL,       -- centroid, used as fallback origin for Haversine
  longitude   NUMERIC(9,6) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city, name)
);
CREATE INDEX idx_districts_city ON districts(city);

-- ============================================================================
-- 3. CAFES
-- ============================================================================
CREATE TABLE cafes (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Legacy "owner of record" — no longer NOT NULL. Actual staff access
  -- (which merchant/admin/cashier login may act on this cafe) is resolved
  -- through cafe_staff below, so a cafe created by super_admin can exist
  -- before any staff account is assigned to it.
  merchant_user_id       BIGINT REFERENCES users(id),
  district_id            BIGINT NOT NULL REFERENCES districts(id),
  name                   TEXT NOT NULL,
  slug                   TEXT NOT NULL UNIQUE,
  description            TEXT,
  address                TEXT NOT NULL,
  latitude               NUMERIC(9,6) NOT NULL,
  longitude              NUMERIC(9,6) NOT NULL,
  price_tier             price_tier NOT NULL DEFAULT '$$',
  phone_number           TEXT,
  whatsapp_number        TEXT NOT NULL,       -- number used for WA API trigger simulation
  cover_image_url        TEXT,
  gallery_urls           JSONB NOT NULL DEFAULT '[]',
  menu_document_url      TEXT,                 -- uploaded PDF/image menu, shown below the floor plan
  menu_document_type     TEXT,                 -- 'pdf' | 'image'
  opening_time           TIME NOT NULL DEFAULT '08:00',
  closing_time           TIME NOT NULL DEFAULT '22:00',
  popularity_score       NUMERIC(6,2) NOT NULL DEFAULT 0,   -- rolling score for "popularity" sort
  avg_rating             NUMERIC(2,1) NOT NULL DEFAULT 0,
  total_reviews          INTEGER NOT NULL DEFAULT 0,
  reservation_enabled    BOOLEAN NOT NULL DEFAULT true,
  requires_down_payment  BOOLEAN NOT NULL DEFAULT true,
  dp_amount              NUMERIC(12,2) NOT NULL DEFAULT 25000,   -- IDR, custom per cafe
  dp_hold_minutes        SMALLINT NOT NULL DEFAULT 10,           -- payment holding timer
  default_slot_minutes   SMALLINT NOT NULL DEFAULT 90,           -- 90/120 min slot logic
  grace_period_minutes   SMALLINT NOT NULL DEFAULT 15,           -- auto-cancel no-show grace
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cafes_district ON cafes(district_id);
CREATE INDEX idx_cafes_price_tier ON cafes(price_tier);
CREATE INDEX idx_cafes_popularity ON cafes(popularity_score DESC);
CREATE INDEX idx_cafes_geo ON cafes(latitude, longitude);
CREATE INDEX idx_cafes_name_trgm ON cafes USING gin (name gin_trgm_ops);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cafes
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ============================================================================
-- 3B. CAFE STAFF (which merchant/admin/cashier login belongs to which cafe)
--
-- Every non-platform staff role — merchant, admin, AND cashier — is scoped
-- to exactly one cafe. The API layer (web/src/lib/staffAuth.ts) reads a
-- signed-in staff user's row here to know (and enforce) which single cafe
-- they may act on: the floor plan builder, menu editing, and the POS board
-- all reject a request whose target cafe doesn't match. Managed by the
-- 'super_admin' role via /admin (create/deactivate/reactivate accounts,
-- and pick which cafe each one belongs to). `user_id` is UNIQUE — one staff
-- login belongs to exactly one cafe, regardless of its role.
-- ============================================================================
CREATE TABLE cafe_staff (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafe_id    BIGINT NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cafe_staff_cafe ON cafe_staff(cafe_id);

-- ============================================================================
-- 4. FLOORS (a cafe has one or more zones/floors, each with its own layout canvas)
-- ============================================================================
CREATE TABLE floors (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafe_id            BIGINT NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,                 -- e.g. "Main Hall", "Rooftop"
  zone_type          zone_type NOT NULL DEFAULT 'indoor',
  level              SMALLINT NOT NULL DEFAULT 1,    -- building floor level: 1 = "Lantai 1", 2 = "Lantai 2", etc.
  canvas_width       INTEGER NOT NULL DEFAULT 1000,  -- design-time px, used to scale on render
  canvas_height      INTEGER NOT NULL DEFAULT 700,
  background_url     TEXT,                           -- optional floor plan background image
  sort_order         SMALLINT NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_floors_cafe ON floors(cafe_id);
CREATE INDEX idx_floors_cafe_level ON floors(cafe_id, level);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON floors
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ============================================================================
-- 5. TABLES (the physical/virtual seats placed on a floor's canvas)
-- ============================================================================
CREATE TABLE tables (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  floor_id        BIGINT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  cafe_id         BIGINT NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,  -- denormalized for fast capacity queries
  table_code      TEXT NOT NULL,               -- e.g. "A1", "OUT-04"
  shape           table_shape NOT NULL DEFAULT 'square',
  pos_x           NUMERIC(8,2) NOT NULL,        -- top-left X on the floor's canvas (design px)
  pos_y           NUMERIC(8,2) NOT NULL,        -- top-left Y on the floor's canvas
  width           NUMERIC(8,2) NOT NULL DEFAULT 80,
  height          NUMERIC(8,2) NOT NULL DEFAULT 80,
  rotation_deg    SMALLINT NOT NULL DEFAULT 0,
  capacity        SMALLINT NOT NULL CHECK (capacity > 0),
  min_capacity    SMALLINT NOT NULL DEFAULT 1,
  status          table_status NOT NULL DEFAULT 'available',
  layout_meta     JSONB NOT NULL DEFAULT '{}',  -- {"x":120,"y":80,"w":80,"h":80,"shape":"round","rotation":0,...}
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (floor_id, table_code)
);
CREATE INDEX idx_tables_floor ON tables(floor_id);
CREATE INDEX idx_tables_cafe_status ON tables(cafe_id, status);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ============================================================================
-- 6. RESERVATIONS
-- ============================================================================
CREATE TABLE reservations (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_code     TEXT NOT NULL UNIQUE DEFAULT ('RSV-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  cafe_id              BIGINT NOT NULL REFERENCES cafes(id),
  table_id             BIGINT REFERENCES tables(id),         -- nullable until assigned
  user_id              BIGINT REFERENCES users(id),          -- NULL for guest reservations
  source               reservation_source NOT NULL DEFAULT 'guest',
  guest_name           TEXT,                                  -- required if source = 'guest'
  guest_whatsapp       TEXT,                                  -- required if source = 'guest'
  party_size           SMALLINT NOT NULL CHECK (party_size > 0),
  slot_minutes         SMALLINT NOT NULL DEFAULT 90,
  start_time           TIMESTAMPTZ NOT NULL,
  end_time             TIMESTAMPTZ NOT NULL,
  grace_period_minutes SMALLINT NOT NULL DEFAULT 15,
  status               reservation_status NOT NULL DEFAULT 'pending_payment',
  qr_code_token        TEXT UNIQUE DEFAULT (encode(gen_random_bytes(16), 'hex')),
  qr_code_url          TEXT,
  notes                TEXT,
  payment_hold_expires_at TIMESTAMPTZ,     -- 10-minute DP hold deadline
  confirmed_at         TIMESTAMPTZ,
  checked_in_at        TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_guest_fields CHECK (
    (source <> 'guest') OR (guest_name IS NOT NULL AND guest_whatsapp IS NOT NULL)
  ),
  CONSTRAINT chk_time_order CHECK (end_time > start_time)
);
CREATE INDEX idx_reservations_cafe_time ON reservations(cafe_id, start_time);
CREATE INDEX idx_reservations_table_time ON reservations(table_id, start_time);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Prevent double-booking the same table for overlapping time ranges
-- (uses the btree_gist extension created up top for the exclusion constraint)
ALTER TABLE reservations
  ADD CONSTRAINT excl_table_time_overlap
  EXCLUDE USING gist (
    table_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (table_id IS NOT NULL AND status IN ('pending_payment','confirmed','checked_in'));

-- ============================================================================
-- 7. PAYMENTS (Down Payment holding + full settlement + refunds)
-- ============================================================================
CREATE TABLE payments (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id   BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  cafe_id          BIGINT NOT NULL REFERENCES cafes(id),
  type             payment_type NOT NULL DEFAULT 'down_payment',
  method           payment_method NOT NULL DEFAULT 'qris',
  amount           NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency         CHAR(3) NOT NULL DEFAULT 'IDR',
  status           payment_status NOT NULL DEFAULT 'pending',
  external_ref     TEXT,             -- payment gateway transaction id
  hold_expires_at  TIMESTAMPTZ,      -- 10-minute countdown deadline
  paid_at          TIMESTAMPTZ,
  failed_reason    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_reservation ON payments(reservation_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ============================================================================
-- 7B. MENU ITEMS (cafe-scoped; writes are gated to cashier/admin in the API layer)
-- ============================================================================
CREATE TABLE menu_items (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cafe_id        BIGINT NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  price          NUMERIC(12,2) NOT NULL DEFAULT 0,
  category       TEXT NOT NULL DEFAULT 'Food',
  image_url      TEXT,
  is_available   BOOLEAN NOT NULL DEFAULT true,
  sort_order     SMALLINT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_items_cafe ON menu_items(cafe_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ============================================================================
-- 8. NOTIFICATION LOGS (WhatsApp / Push simulation audit trail)
-- ============================================================================
CREATE TABLE notification_logs (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id BIGINT REFERENCES reservations(id) ON DELETE CASCADE,
  user_id        BIGINT REFERENCES users(id),
  channel        notification_channel NOT NULL,
  type           notification_type NOT NULL,
  recipient      TEXT NOT NULL,           -- phone number, device token, or email
  payload        JSONB NOT NULL DEFAULT '{}',
  status         notification_status NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  scheduled_for  TIMESTAMPTZ,             -- e.g. H-1 hour reminder scheduled time
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_reservation ON notification_logs(reservation_id);
CREATE INDEX idx_notifications_scheduled ON notification_logs(scheduled_for) WHERE status = 'queued';

-- ============================================================================
-- 9. CASHIER / POS ACTION AUDIT LOG
-- ============================================================================
CREATE TABLE table_status_logs (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_id       BIGINT NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  reservation_id BIGINT REFERENCES reservations(id),
  cashier_id     BIGINT NOT NULL REFERENCES users(id),
  action         cashier_action NOT NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_table_status_logs_table ON table_status_logs(table_id, created_at DESC);

-- ============================================================================
-- 10. LIVE CAPACITY VIEW
-- ----------------------------------------------------------------------------
-- Powers the Green(<50%) / Yellow(50–85%) / Red(>85%) indicator. Computed live
-- from `tables.status` (source of truth after POS check-in/checkout actions)
-- rather than recomputed reservation math, so the dashboard reflects reality
-- the instant a cashier taps a button.
-- ============================================================================
CREATE VIEW cafe_live_capacity AS
SELECT
  c.id                                           AS cafe_id,
  c.name                                         AS cafe_name,
  COUNT(t.id) FILTER (WHERE t.is_active)         AS total_tables,
  SUM(t.capacity) FILTER (WHERE t.is_active)     AS total_seats,
  COUNT(t.id) FILTER (WHERE t.status = 'available' AND t.is_active)   AS tables_available,
  COUNT(t.id) FILTER (WHERE t.status = 'reserved'  AND t.is_active)   AS tables_reserved,
  COUNT(t.id) FILTER (WHERE t.status = 'occupied'  AND t.is_active)   AS tables_occupied,
  ROUND(
    100.0 * COUNT(t.id) FILTER (WHERE t.status IN ('occupied','reserved') AND t.is_active)
    / NULLIF(COUNT(t.id) FILTER (WHERE t.is_active), 0), 1
  )                                               AS occupancy_pct,
  CASE
    WHEN COUNT(t.id) FILTER (WHERE t.is_active) = 0 THEN 'unknown'
    WHEN 100.0 * COUNT(t.id) FILTER (WHERE t.status IN ('occupied','reserved') AND t.is_active)
         / NULLIF(COUNT(t.id) FILTER (WHERE t.is_active), 0) > 85 THEN 'red'
    WHEN 100.0 * COUNT(t.id) FILTER (WHERE t.status IN ('occupied','reserved') AND t.is_active)
         / NULLIF(COUNT(t.id) FILTER (WHERE t.is_active), 0) >= 50 THEN 'yellow'
    ELSE 'green'
  END                                             AS capacity_color
FROM cafes c
LEFT JOIN tables t ON t.cafe_id = c.id
GROUP BY c.id, c.name;

-- ============================================================================
-- 11. SEED DATA (minimal, for local dev / demo)
-- ============================================================================
INSERT INTO districts (province, city, name, latitude, longitude) VALUES
  ('DKI Jakarta', 'Jakarta Selatan', 'Kebayoran Baru', -6.2440, 106.7990),
  ('DKI Jakarta', 'Jakarta Selatan', 'Senopati',        -6.2280, 106.8110),
  ('DKI Jakarta', 'Jakarta Pusat',   'Menteng',         -6.1957, 106.8305),
  ('DKI Jakarta', 'Jakarta Barat',  'Kebon Jeruk',      -6.1934, 106.7659);

-- ============================================================================
-- Notes on scaling choices:
--  * `tables.status` is the live source of truth for capacity math — it is
--    flipped by POS actions (check-in, checkout) and by the reservation
--    state machine (reserved on confirm, available on cancel/expire).
--  * The EXCLUDE constraint on reservations prevents overlapping bookings
--    at the database layer, in addition to any app-level slot validation.
--  * For very high read QPS on `cafe_live_capacity`, materialize it and
--    refresh via a lightweight LISTEN/NOTIFY trigger on `tables` instead of
--    querying the plain view on every request.
-- ============================================================================
