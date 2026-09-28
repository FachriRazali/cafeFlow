import { Cafe, CafeTable, CashierAction, District, Floor, MenuItem, NotificationLogEntry, Payment, Reservation } from "./types";
import { haversineDistanceKm } from "./haversine";
import { pool, query, withTransaction } from "./db";

// ============================================================================
// Postgres-backed data layer (database/schema.sql).
//
// Every function here has a 1:1 counterpart described in docs/API_SPEC.md.
// Route handlers only ever import functions from this module — never touch
// `pool`/SQL directly — so this file is the single place that knows the
// schema's column names.
// ============================================================================

const DEMO_CASHIER_USER_ID = 2; // seeded in database/seed.sql — stands in for an authenticated cashier

// cafe_live_capacity's capacity_color is 'green' | 'yellow' | 'red' | 'unknown'
// ('unknown' = zero active tables, e.g. a cafe super_admin just created via
// /admin before its first floor/table exists). The frontend's CapacityColor
// type only has the three real colors, so 'unknown' is normalized to
// 'green' here — "nothing to show yet" reads the same as "fully open".
function normalizeCapacityColor(v: string | null | undefined): "green" | "yellow" | "red" {
  return v === "yellow" || v === "red" ? v : "green";
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export type StaffRole = "merchant" | "admin" | "cashier";

export interface UserForLogin {
  id: number;
  fullName: string;
  email: string;
  passwordHash: string | null;
  role: "super_admin" | "admin" | "merchant" | "cashier" | "customer";
  cafeId?: number; // for role "merchant" | "admin" | "cashier" — which cafe this login is scoped to
}

export async function findUserForLogin(email: string): Promise<UserForLogin | undefined> {
  const rows = await query<any>(
    `SELECT u.id, u.full_name, u.email, u.password_hash, r.code AS role, cs.cafe_id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN cafe_staff cs ON cs.user_id = u.id
     WHERE u.email = $1 AND u.is_active = true`,
    [email]
  );
  const r = rows[0];
  if (!r) return undefined;
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    passwordHash: r.password_hash,
    role: r.role,
    cafeId: r.cafe_id ?? undefined
  };
}

export async function touchLastLogin(userId: number): Promise<void> {
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
}

// ---------------------------------------------------------------------------
// Super admin — cafes + per-cafe staff account management
//
// Every merchant/admin/cashier login belongs to exactly one cafe
// (cafe_staff, UNIQUE on user_id). super_admin is the only role that isn't
// cafe-scoped, and it's the only role that can create cafes or staff
// accounts at all — see web/src/lib/staffAuth.ts's requireSuperAdmin.
// ---------------------------------------------------------------------------
export interface StaffAccount {
  id: number;
  fullName: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

export async function listStaffForCafe(cafeId: number): Promise<StaffAccount[]> {
  const rows = await query<any>(
    `SELECT u.id, u.full_name, u.email, u.is_active, cs.created_at, r.code AS role
     FROM cafe_staff cs
     JOIN users u ON u.id = cs.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE cs.cafe_id = $1
     ORDER BY cs.created_at ASC`,
    [cafeId]
  );
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    role: r.role,
    isActive: r.is_active,
    createdAt: r.created_at
  }));
}

export async function createStaffAccount(input: {
  cafeId: number;
  role: StaffRole;
  fullName: string;
  email: string;
  passwordHash: string;
}): Promise<StaffAccount> {
  return withTransaction(async (client) => {
    const cafeRows = await client.query(`SELECT id FROM cafes WHERE id = $1`, [input.cafeId]);
    if (cafeRows.rowCount === 0) throw new Error("NOT_FOUND");
    const existing = await client.query(`SELECT id FROM users WHERE email = $1`, [input.email]);
    if ((existing.rowCount ?? 0) > 0) throw new Error("EMAIL_TAKEN");
    const roleRow = await client.query(`SELECT id FROM roles WHERE code = $1`, [input.role]);
    const userRow = await client.query(
      `INSERT INTO users (role_id, full_name, email, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, is_active`,
      [roleRow.rows[0].id, input.fullName, input.email, input.passwordHash]
    );
    const u = userRow.rows[0];
    const csRow = await client.query(
      `INSERT INTO cafe_staff (cafe_id, user_id) VALUES ($1, $2) RETURNING created_at`,
      [input.cafeId, u.id]
    );
    return { id: u.id, fullName: u.full_name, email: u.email, role: input.role, isActive: u.is_active, createdAt: csRow.rows[0].created_at };
  });
}

export async function updateStaffAccount(
  userId: number,
  patch: { fullName?: string; passwordHash?: string; isActive?: boolean }
): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];
  let i = 1;
  if (patch.fullName !== undefined) {
    sets.push(`full_name = $${i++}`);
    values.push(patch.fullName);
  }
  if (patch.passwordHash !== undefined) {
    sets.push(`password_hash = $${i++}`);
    values.push(patch.passwordHash);
  }
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${i++}`);
    values.push(patch.isActive);
  }
  if (sets.length === 0) return;
  values.push(userId);
  await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${i}`, values);
}

// Soft-delete only — a hard delete would cascade into table_status_logs'
// cashier_id FK and erase history of who checked guests in/out.
export async function deactivateStaffAccount(userId: number): Promise<void> {
  await query(`UPDATE users SET is_active = false WHERE id = $1`, [userId]);
}

// Lightweight cafe picker for /admin — full listCafes() below computes
// distance/live-capacity the admin UI doesn't need.
export async function listCafesForAdmin(): Promise<{ id: number; name: string; isActive: boolean }[]> {
  const rows = await query<any>(`SELECT id, name, is_active FROM cafes ORDER BY name`);
  return rows.map((r) => ({ id: r.id, name: r.name, isActive: r.is_active }));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "cafe";
}

export interface CreateCafeInput {
  name: string;
  districtId: number;
  address: string;
  latitude: number;
  longitude: number;
  whatsappNumber: string;
  priceTier?: "$" | "$$" | "$$$";
  description?: string;
}

// Created by super_admin via /admin — no merchant/admin/cashier is attached
// yet (merchant_user_id is nullable; use createStaffAccount right after to
// assign its first staff account). Slug is derived from the name with a
// numeric suffix on collision so this never fails on a duplicate name.
export async function createCafe(input: CreateCafeInput): Promise<{ id: number; name: string }> {
  const base = slugify(input.name);
  let slug = base;
  for (let attempt = 0; attempt < 20; attempt++) {
    const clash = await query<any>(`SELECT 1 FROM cafes WHERE slug = $1`, [slug]);
    if (clash.length === 0) break;
    slug = `${base}-${attempt + 2}`;
  }
  const rows = await query<any>(
    `INSERT INTO cafes (district_id, name, slug, description, address, latitude, longitude, price_tier, whatsapp_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, name`,
    [
      input.districtId,
      input.name,
      slug,
      input.description ?? null,
      input.address,
      input.latitude,
      input.longitude,
      input.priceTier ?? "$$",
      input.whatsappNumber
    ]
  );
  return { id: rows[0].id, name: rows[0].name };
}

export async function updateCafeStatus(cafeId: number, isActive: boolean): Promise<void> {
  await query(`UPDATE cafes SET is_active = $2 WHERE id = $1`, [cafeId, isActive]);
}

// ---------------------------------------------------------------------------
// Districts
// ---------------------------------------------------------------------------
export async function getDistricts(): Promise<District[]> {
  const rows = await query<any>(`SELECT id, city, name, latitude, longitude FROM districts ORDER BY city, name`);
  return rows.map((r) => ({ id: r.id, city: r.city, name: r.name, lat: Number(r.latitude), lng: Number(r.longitude) }));
}

// ---------------------------------------------------------------------------
// Cafes + live capacity
// ---------------------------------------------------------------------------
const CAFE_SELECT = `
  SELECT
    c.id, c.name, c.slug, c.description, c.district_id, d.name AS district_name,
    c.address, c.latitude, c.longitude, c.price_tier, c.whatsapp_number, c.cover_image_url,
    c.menu_document_url, c.menu_document_type,
    c.opening_time, c.closing_time, c.popularity_score, c.avg_rating, c.total_reviews,
    c.requires_down_payment, c.dp_amount, c.dp_hold_minutes, c.default_slot_minutes, c.grace_period_minutes,
    COALESCE(lc.total_tables, 0)      AS total_tables,
    COALESCE(lc.tables_available, 0)  AS tables_available,
    COALESCE(lc.tables_reserved, 0)   AS tables_reserved,
    COALESCE(lc.tables_occupied, 0)   AS tables_occupied,
    COALESCE(lc.occupancy_pct, 0)     AS occupancy_pct,
    COALESCE(lc.capacity_color, 'green') AS capacity_color
  FROM cafes c
  JOIN districts d ON d.id = c.district_id
  LEFT JOIN cafe_live_capacity lc ON lc.cafe_id = c.id
  WHERE c.is_active = true
`;

function mapCafeRow(r: any, origin?: { lat: number; lng: number }): Cafe {
  const lat = Number(r.latitude);
  const lng = Number(r.longitude);
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? "",
    districtId: r.district_id,
    districtName: r.district_name,
    address: r.address,
    lat,
    lng,
    priceTier: r.price_tier,
    whatsappNumber: r.whatsapp_number,
    coverImageUrl: r.cover_image_url ?? "",
    openingTime: String(r.opening_time ?? "08:00:00").slice(0, 5),
    closingTime: String(r.closing_time ?? "22:00:00").slice(0, 5),
    popularityScore: Number(r.popularity_score),
    avgRating: Number(r.avg_rating),
    totalReviews: r.total_reviews,
    requiresDownPayment: r.requires_down_payment,
    dpAmount: Number(r.dp_amount),
    dpHoldMinutes: r.dp_hold_minutes,
    defaultSlotMinutes: r.default_slot_minutes,
    gracePeriodMinutes: r.grace_period_minutes,
    liveCapacity: {
      occupancyPct: Number(r.occupancy_pct),
      color: normalizeCapacityColor(r.capacity_color),
      tablesAvailable: Number(r.tables_available),
      tablesReserved: Number(r.tables_reserved),
      tablesOccupied: Number(r.tables_occupied),
      totalTables: Number(r.total_tables),
      updatedAt: new Date().toISOString()
    },
    distanceKm: origin ? haversineDistanceKm(origin.lat, origin.lng, lat, lng) : undefined,
    menuDocumentUrl: r.menu_document_url ?? undefined,
    menuDocumentType: r.menu_document_type ?? undefined
  };
}

export interface CafeQuery {
  lat?: number;
  lng?: number;
  districtId?: number;
  priceTiers?: string[];
  sort?: "popularity" | "distance" | "availability";
  availability?: "green" | "yellow" | "red" | "any";
  q?: string;
}

export async function listCafes(q: CafeQuery): Promise<Cafe[]> {
  const rows = await query<any>(CAFE_SELECT);
  const origin = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined;
  let results = rows.map((r) => mapCafeRow(r, origin));

  if (q.districtId) results = results.filter((c) => c.districtId === q.districtId);
  if (q.priceTiers?.length) results = results.filter((c) => q.priceTiers!.includes(c.priceTier));
  if (q.availability && q.availability !== "any") results = results.filter((c) => c.liveCapacity.color === q.availability);
  if (q.q) {
    const needle = q.q.toLowerCase();
    results = results.filter((c) => c.name.toLowerCase().includes(needle) || c.address.toLowerCase().includes(needle));
  }

  const sort = q.sort ?? (origin ? "distance" : "popularity");
  results.sort((a, b) => {
    if (sort === "distance") return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
    if (sort === "availability") return a.liveCapacity.occupancyPct - b.liveCapacity.occupancyPct;
    return b.popularityScore - a.popularityScore;
  });
  return results;
}

export async function getCafe(id: number, origin?: { lat: number; lng: number }): Promise<Cafe | undefined> {
  const rows = await query<any>(`${CAFE_SELECT} AND c.id = $1`, [id]);
  return rows[0] ? mapCafeRow(rows[0], origin) : undefined;
}

export async function getLiveCapacity(cafeId: number) {
  const rows = await query<any>(`SELECT * FROM cafe_live_capacity WHERE cafe_id = $1`, [cafeId]);
  const r = rows[0];
  if (!r) return { occupancyPct: 0, color: "green" as const, tablesAvailable: 0, tablesReserved: 0, tablesOccupied: 0, totalTables: 0, updatedAt: new Date().toISOString() };
  return {
    occupancyPct: Number(r.occupancy_pct ?? 0),
    color: normalizeCapacityColor(r.capacity_color),
    tablesAvailable: Number(r.tables_available ?? 0),
    tablesReserved: Number(r.tables_reserved ?? 0),
    tablesOccupied: Number(r.tables_occupied ?? 0),
    totalTables: Number(r.total_tables ?? 0),
    updatedAt: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Floors + tables
// ---------------------------------------------------------------------------
function mapTableRow(r: any): CafeTable {
  return {
    id: r.table_id ?? r.id,
    floorId: r.floor_id,
    cafeId: r.cafe_id,
    tableCode: r.table_code,
    shape: r.shape,
    x: Number(r.pos_x),
    y: Number(r.pos_y),
    width: Number(r.width),
    height: Number(r.height),
    rotation: r.rotation_deg,
    capacity: r.capacity,
    status: r.status,
    currentReservationId: null
  };
}

export async function getFloors(cafeId: number): Promise<Floor[]> {
  const rows = await query<any>(
    `SELECT f.id AS floor_id, f.cafe_id, f.name AS floor_name, f.zone_type, f.level, f.canvas_width, f.canvas_height, f.sort_order,
            t.id AS table_id, t.table_code, t.shape, t.pos_x, t.pos_y, t.width, t.height, t.rotation_deg, t.capacity, t.status
     FROM floors f
     LEFT JOIN tables t ON t.floor_id = f.id AND t.is_active = true
     WHERE f.cafe_id = $1 AND f.is_active = true
     ORDER BY f.level, f.sort_order, f.id, t.id`,
    [cafeId]
  );
  const floors = new Map<number, Floor>();
  for (const r of rows) {
    if (!floors.has(r.floor_id)) {
      floors.set(r.floor_id, {
        id: r.floor_id,
        cafeId: r.cafe_id,
        name: r.floor_name,
        zoneType: r.zone_type,
        level: r.level,
        canvasWidth: r.canvas_width,
        canvasHeight: r.canvas_height,
        tables: []
      });
    }
    if (r.table_id) floors.get(r.floor_id)!.tables.push(mapTableRow({ ...r, floor_id: r.floor_id, cafe_id: r.cafe_id }));
  }
  return [...floors.values()];
}

export interface LayoutTableInput {
  tableCode: string;
  shape: CafeTable["shape"];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  capacity: number;
}

export async function saveFloorLayout(floorId: number, tables: LayoutTableInput[], authorizedCafeId?: number) {
  return withTransaction(async (client) => {
    const floorRes = await client.query(`SELECT id, cafe_id FROM floors WHERE id = $1`, [floorId]);
    const floor = floorRes.rows[0];
    if (!floor) return undefined;
    // A merchant/admin session is scoped to exactly one cafe — reject
    // before mutating if this floor belongs to a different one.
    if (authorizedCafeId !== undefined && floor.cafe_id !== authorizedCafeId) {
      throw new Error("FORBIDDEN");
    }

    for (const t of tables) {
      await client.query(
        `INSERT INTO tables (floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, rotation_deg, capacity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (floor_id, table_code) DO UPDATE SET
           shape = excluded.shape, pos_x = excluded.pos_x, pos_y = excluded.pos_y,
           width = excluded.width, height = excluded.height, rotation_deg = excluded.rotation_deg,
           capacity = excluded.capacity`,
        [floorId, floor.cafe_id, t.tableCode, t.shape, t.x, t.y, t.width, t.height, t.rotation, t.capacity]
      );
    }
    const keepCodes = tables.map((t) => t.tableCode);
    await client.query(
      `DELETE FROM tables WHERE floor_id = $1 AND NOT (table_code = ANY($2::text[]))`,
      [floorId, keepCodes.length ? keepCodes : [""]]
    );

    const tableRows = await client.query(
      `SELECT id AS table_id, floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, rotation_deg, capacity, status
       FROM tables WHERE floor_id = $1 ORDER BY id`,
      [floorId]
    );
    return { id: floorId, tables: tableRows.rows.map(mapTableRow) };
  });
}

export interface CreateFloorInput {
  cafeId: number;
  name: string;
  zoneType: Floor["zoneType"];
  level: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

/** Adds a new zone/level to a cafe's floor plan from the merchant builder (used by "+ Level" and "+ zone"). */
export async function createFloor(input: CreateFloorInput): Promise<Floor> {
  const sortRes = await query<{ next: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM floors WHERE cafe_id = $1 AND level = $2`,
    [input.cafeId, input.level]
  );
  const sortOrder = sortRes[0]?.next ?? 0;
  const rows = await query<any>(
    `INSERT INTO floors (cafe_id, name, zone_type, level, canvas_width, canvas_height, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, cafe_id, name, zone_type, level, canvas_width, canvas_height`,
    [input.cafeId, input.name, input.zoneType, input.level, input.canvasWidth ?? 900, input.canvasHeight ?? 560, sortOrder]
  );
  const f = rows[0];
  return {
    id: f.id,
    cafeId: f.cafe_id,
    name: f.name,
    zoneType: f.zone_type,
    level: f.level,
    canvasWidth: f.canvas_width,
    canvasHeight: f.canvas_height,
    tables: []
  };
}

// ---------------------------------------------------------------------------
// Menu (staff-only writes, enforced by the API layer's PIN check)
// ---------------------------------------------------------------------------
function mapMenuItemRow(r: any): MenuItem {
  return {
    id: r.id,
    cafeId: r.cafe_id,
    name: r.name,
    description: r.description ?? "",
    price: Number(r.price),
    category: r.category,
    imageUrl: r.image_url ?? undefined,
    isAvailable: r.is_available,
    sortOrder: r.sort_order
  };
}

export async function getMenuItems(cafeId: number): Promise<MenuItem[]> {
  const rows = await query<any>(
    `SELECT * FROM menu_items WHERE cafe_id = $1 ORDER BY category, sort_order, id`,
    [cafeId]
  );
  return rows.map(mapMenuItemRow);
}

export interface CreateMenuItemInput {
  cafeId: number;
  name: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  isAvailable?: boolean;
}

export async function createMenuItem(input: CreateMenuItemInput): Promise<MenuItem> {
  const sortRes = await query<{ next: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM menu_items WHERE cafe_id = $1`,
    [input.cafeId]
  );
  const rows = await query<any>(
    `INSERT INTO menu_items (cafe_id, name, description, price, category, image_url, is_available, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      input.cafeId, input.name, input.description ?? null, input.price, input.category,
      input.imageUrl ?? null, input.isAvailable ?? true, sortRes[0]?.next ?? 0
    ]
  );
  return mapMenuItemRow(rows[0]);
}

export interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  imageUrl?: string;
  isAvailable?: boolean;
}

// `cafeId` scopes the WHERE clause (not just an after-the-fact check) — a
// merchant/admin/cashier session is bound to one cafe, so a request naming
// another cafe's item id simply matches zero rows and reads as NOT_FOUND,
// same as a made-up id. Route handlers pass the URL's cafe id here.
export async function updateMenuItem(id: number, cafeId: number, patch: UpdateMenuItemInput): Promise<MenuItem | undefined> {
  const rows = await query<any>(
    `UPDATE menu_items SET
       name = COALESCE($3, name),
       description = COALESCE($4, description),
       price = COALESCE($5, price),
       category = COALESCE($6, category),
       image_url = COALESCE($7, image_url),
       is_available = COALESCE($8, is_available)
     WHERE id = $1 AND cafe_id = $2 RETURNING *`,
    [id, cafeId, patch.name, patch.description, patch.price, patch.category, patch.imageUrl, patch.isAvailable]
  );
  return rows[0] ? mapMenuItemRow(rows[0]) : undefined;
}

export async function deleteMenuItem(id: number, cafeId: number): Promise<boolean> {
  const rows = await query<any>(`DELETE FROM menu_items WHERE id = $1 AND cafe_id = $2 RETURNING id`, [id, cafeId]);
  return rows.length > 0;
}

export async function setMenuDocument(cafeId: number, url: string, type: "pdf" | "image"): Promise<void> {
  await query(`UPDATE cafes SET menu_document_url = $2, menu_document_type = $3 WHERE id = $1`, [cafeId, url, type]);
}

// ---------------------------------------------------------------------------
// Reservations + payments
// ---------------------------------------------------------------------------
function mapReservationRow(r: any): Reservation {
  return {
    id: r.id,
    reservationCode: r.reservation_code,
    cafeId: r.cafe_id,
    tableId: r.table_id,
    userId: r.user_id,
    source: r.source,
    guestName: r.guest_name ?? undefined,
    guestWhatsapp: r.guest_whatsapp ?? undefined,
    partySize: r.party_size,
    slotMinutes: r.slot_minutes,
    startTime: new Date(r.start_time).toISOString(),
    endTime: new Date(r.end_time).toISOString(),
    gracePeriodMinutes: r.grace_period_minutes,
    status: r.status,
    qrCodeToken: r.qr_code_token,
    paymentHoldExpiresAt: r.payment_hold_expires_at ? new Date(r.payment_hold_expires_at).toISOString() : null
  };
}

function mapPaymentRow(r: any): Payment {
  return {
    id: r.id,
    reservationId: r.reservation_id,
    amount: Number(r.amount),
    currency: "IDR",
    status: r.status,
    holdExpiresAt: r.hold_expires_at ? new Date(r.hold_expires_at).toISOString() : new Date().toISOString(),
    method: r.method
  };
}

export interface CreateReservationInput {
  cafeId: number;
  tableId: number;
  partySize: number;
  slotMinutes: number;
  startTime: string;
  guestName?: string;
  guestWhatsapp?: string;
  userId?: number;
}

export async function createReservation(input: CreateReservationInput) {
  const result = await withTransaction(async (client) => {
    const tableRes = await client.query(`SELECT id, cafe_id, status FROM tables WHERE id = $1 FOR UPDATE`, [input.tableId]);
    const table = tableRes.rows[0];
    if (!table) throw new Error("NOT_FOUND");
    if (table.status !== "available") throw new Error("TABLE_ALREADY_RESERVED");

    const cafeRes = await client.query(
      `SELECT requires_down_payment, dp_amount, dp_hold_minutes FROM cafes WHERE id = $1`,
      [table.cafe_id]
    );
    const cafe = cafeRes.rows[0];
    if (!cafe) throw new Error("NOT_FOUND");

    const start = new Date(input.startTime);
    const end = new Date(start.getTime() + input.slotMinutes * 60_000);
    const status = cafe.requires_down_payment ? "pending_payment" : "confirmed";
    const holdExpiresAt = cafe.requires_down_payment ? new Date(Date.now() + cafe.dp_hold_minutes * 60_000) : null;

    let resRow;
    try {
      const inserted = await client.query(
        `INSERT INTO reservations
           (cafe_id, table_id, user_id, source, guest_name, guest_whatsapp, party_size, slot_minutes, start_time, end_time, status, payment_hold_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          table.cafe_id, table.id, input.userId ?? null, input.userId ? "registered" : "guest",
          input.guestName ?? null, input.guestWhatsapp ?? null, input.partySize, input.slotMinutes,
          start.toISOString(), end.toISOString(), status, holdExpiresAt
        ]
      );
      resRow = inserted.rows[0];
    } catch (err: any) {
      if (err?.code === "23P01") throw new Error("TABLE_ALREADY_RESERVED"); // exclusion_violation (overlapping slot)
      if (err?.code === "23503") throw new Error("INVALID_USER"); // foreign_key_violation on user_id
      throw err;
    }

    await client.query(`UPDATE tables SET status = 'reserved' WHERE id = $1`, [table.id]);

    let paymentRow: any | undefined;
    if (cafe.requires_down_payment) {
      const p = await client.query(
        `INSERT INTO payments (reservation_id, cafe_id, type, amount, status, hold_expires_at)
         VALUES ($1, $2, 'down_payment', $3, 'pending', $4) RETURNING *`,
        [resRow.id, table.cafe_id, cafe.dp_amount, holdExpiresAt]
      );
      paymentRow = p.rows[0];
    }

    return { reservation: mapReservationRow(resRow), payment: paymentRow ? mapPaymentRow(paymentRow) : undefined };
  });

  if (!result.payment) {
    await logNotification(result.reservation, "qr_ticket");
    await logNotification(result.reservation, "reminder_h1");
  }
  return result;
}

export async function confirmPayment(paymentId: number) {
  const transitioned = await query<any>(
    `UPDATE payments SET status = 'paid', paid_at = now() WHERE id = $1 AND status <> 'paid' RETURNING *`,
    [paymentId]
  );

  let paymentRow = transitioned[0];
  if (!paymentRow) {
    const existing = await query<any>(`SELECT * FROM payments WHERE id = $1`, [paymentId]);
    if (!existing[0]) throw new Error("NOT_FOUND");
    paymentRow = existing[0];
  }

  const reservationRows = await query<any>(
    transitioned[0]
      ? `UPDATE reservations SET status = 'confirmed', confirmed_at = now() WHERE id = $1 RETURNING *`
      : `SELECT * FROM reservations WHERE id = $1`,
    [paymentRow.reservation_id]
  );
  const reservation = reservationRows[0] ? mapReservationRow(reservationRows[0]) : undefined;

  if (transitioned[0] && reservation) {
    await logNotification(reservation, "qr_ticket");
    await logNotification(reservation, "reminder_h1");
  }
  return { payment: mapPaymentRow(paymentRow), reservation };
}

export async function getReservation(id: number) {
  const rows = await query<any>(`SELECT * FROM reservations WHERE id = $1`, [id]);
  return rows[0] ? mapReservationRow(rows[0]) : undefined;
}

export async function getReservationByCode(code: string) {
  const rows = await query<any>(`SELECT * FROM reservations WHERE reservation_code = $1`, [code]);
  return rows[0] ? mapReservationRow(rows[0]) : undefined;
}

export async function getReservationByToken(token: string) {
  const rows = await query<any>(`SELECT * FROM reservations WHERE qr_code_token = $1`, [token]);
  return rows[0] ? mapReservationRow(rows[0]) : undefined;
}

export async function cancelReservation(id: number) {
  const rows = await query<any>(
    `UPDATE reservations SET status = 'cancelled', cancelled_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!rows[0]) throw new Error("NOT_FOUND");
  const reservation = mapReservationRow(rows[0]);
  if (reservation.tableId) await query(`UPDATE tables SET status = 'available' WHERE id = $1`, [reservation.tableId]);
  await logNotification(reservation, "cancellation");
  return reservation;
}

async function logNotification(reservation: Reservation, type: "qr_ticket" | "reminder_h1" | "cancellation" | "checked_in") {
  const messages: Record<string, string> = {
    qr_ticket: `Your table is booked! Show this QR at ${reservation.reservationCode} check-in.`,
    reminder_h1: `Reminder: your reservation ${reservation.reservationCode} starts in 1 hour.`,
    cancellation: `Reservation ${reservation.reservationCode} has been cancelled.`,
    checked_in: `You're checked in — enjoy! (${reservation.reservationCode})`
  };
  const recipient = reservation.guestWhatsapp ?? "registered-user";
  await query(
    `INSERT INTO notification_logs (reservation_id, channel, type, recipient, payload, status, sent_at)
     VALUES ($1, 'whatsapp', $2, $3, $4::jsonb, 'sent', now())`,
    [reservation.id, type, recipient, JSON.stringify({ message: messages[type] })]
  );
}

export async function getNotificationLogs(limit = 20): Promise<NotificationLogEntry[]> {
  const rows = await query<any>(
    `SELECT id, reservation_id, channel, type, recipient, status, created_at, payload
     FROM notification_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    reservationId: r.reservation_id,
    channel: r.channel,
    type: r.type,
    recipient: r.recipient,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    message: r.payload?.message ?? r.type
  }));
}

// ---------------------------------------------------------------------------
// Cashier POS
// ---------------------------------------------------------------------------
export async function posListTables(cafeId: number) {
  const rows = await query<any>(
    `SELECT t.id AS table_id, t.floor_id, t.cafe_id, t.table_code, t.shape, t.pos_x, t.pos_y, t.width, t.height,
            t.rotation_deg, t.capacity, t.status,
            r.id AS res_id, r.reservation_code AS res_reservation_code, r.user_id AS res_user_id, r.source AS res_source,
            r.guest_name AS res_guest_name, r.guest_whatsapp AS res_guest_whatsapp, r.party_size AS res_party_size,
            r.slot_minutes AS res_slot_minutes, r.start_time AS res_start_time, r.end_time AS res_end_time,
            r.grace_period_minutes AS res_grace_period_minutes, r.status AS res_status,
            r.qr_code_token AS res_qr_code_token, r.payment_hold_expires_at AS res_payment_hold_expires_at,
            r.cafe_id AS res_cafe_id, r.table_id AS res_table_id
     FROM tables t
     LEFT JOIN LATERAL (
       SELECT * FROM reservations res
       WHERE res.table_id = t.id AND res.status IN ('pending_payment', 'confirmed', 'checked_in')
       ORDER BY res.start_time DESC LIMIT 1
     ) r ON true
     WHERE t.cafe_id = $1 AND t.is_active = true
     ORDER BY t.id`,
    [cafeId]
  );

  return rows.map((r) => {
    const table = mapTableRow(r);
    const reservation = r.res_id
      ? mapReservationRow({
          id: r.res_id, reservation_code: r.res_reservation_code, cafe_id: r.res_cafe_id, table_id: r.res_table_id,
          user_id: r.res_user_id, source: r.res_source, guest_name: r.res_guest_name, guest_whatsapp: r.res_guest_whatsapp,
          party_size: r.res_party_size, slot_minutes: r.res_slot_minutes, start_time: r.res_start_time, end_time: r.res_end_time,
          grace_period_minutes: r.res_grace_period_minutes, status: r.res_status, qr_code_token: r.res_qr_code_token,
          payment_hold_expires_at: r.res_payment_hold_expires_at
        })
      : undefined;
    return { ...table, reservation };
  });
}

export async function posAction(
  tableId: number,
  action: CashierAction,
  opts?: { partySize?: number; authorizedCafeId?: number; cashierUserId?: number }
) {
  return withTransaction(async (client) => {
    const tableRes = await client.query(`SELECT * FROM tables WHERE id = $1 FOR UPDATE`, [tableId]);
    const tableRow = tableRes.rows[0];
    if (!tableRow) throw new Error("NOT_FOUND");
    // A cashier/admin session is scoped to exactly one cafe (see cafe_staff)
    // — block any attempt to act on another cafe's table even if the
    // tableId is guessed/enumerated. Only super_admin passes no
    // authorizedCafeId (unrestricted).
    if (opts?.authorizedCafeId !== undefined && tableRow.cafe_id !== opts.authorizedCafeId) {
      throw new Error("FORBIDDEN");
    }

    let activeReservationId: number | null = null;
    let newStatus = tableRow.status;

    if (action === "check_in_qr" || action === "check_in_manual") {
      const r = await client.query(
        `SELECT id FROM reservations WHERE table_id = $1 AND status IN ('pending_payment','confirmed') ORDER BY start_time DESC LIMIT 1`,
        [tableId]
      );
      if (r.rows[0]) {
        activeReservationId = r.rows[0].id;
        await client.query(`UPDATE reservations SET status = 'checked_in', checked_in_at = now() WHERE id = $1`, [activeReservationId]);
      }
      newStatus = "occupied";
    } else if (action === "walk_in_seat") {
      newStatus = "occupied";
    } else if (action === "checkout") {
      const r = await client.query(
        `SELECT id FROM reservations WHERE table_id = $1 AND status = 'checked_in' ORDER BY start_time DESC LIMIT 1`,
        [tableId]
      );
      if (r.rows[0]) {
        activeReservationId = r.rows[0].id;
        await client.query(`UPDATE reservations SET status = 'completed', completed_at = now() WHERE id = $1`, [activeReservationId]);
      }
      newStatus = "available";
    } else if (action === "mark_available") {
      newStatus = "available";
    } else if (action === "mark_occupied") {
      newStatus = "occupied";
    } else if (action === "mark_reserved") {
      newStatus = "reserved";
    } else if (action === "mark_maintenance") {
      newStatus = "maintenance";
    }

    const updated = await client.query(
      `UPDATE tables SET status = $1 WHERE id = $2
       RETURNING id AS table_id, floor_id, cafe_id, table_code, shape, pos_x, pos_y, width, height, rotation_deg, capacity, status`,
      [newStatus, tableId]
    );
    await client.query(
      `INSERT INTO table_status_logs (table_id, reservation_id, cashier_id, action) VALUES ($1, $2, $3, $4)`,
      [tableId, activeReservationId, opts?.cashierUserId ?? DEMO_CASHIER_USER_ID, action]
    );

    return mapTableRow(updated.rows[0]);
  });
}
