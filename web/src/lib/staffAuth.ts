import { NextRequest, NextResponse } from "next/server";
import { getSession, SessionUser } from "@/lib/session";

type StaffRole = "merchant" | "admin" | "cashier";
const ALL_STAFF_ROLES: StaffRole[] = ["merchant", "admin", "cashier"];

// merchant, admin AND cashier are all bound to exactly one cafe (cafe_staff)
// — only super_admin is unrestricted across cafes. Every staff-only route
// calls requireStaffSession() to check the role, then assertCafeMatch() (or
// passes scopedCafeId() straight into a store.ts write) to enforce that the
// session's one cafe actually matches the cafe/table/item being touched.
export async function requireStaffSession(
  req: NextRequest,
  opts?: { roles?: StaffRole[] }
): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getSession(req);
  const roles = opts?.roles ?? ALL_STAFF_ROLES;
  if (!user || (user.role !== "super_admin" && !roles.includes(user.role as StaffRole))) {
    return NextResponse.json(
      { error: { code: "STAFF_ONLY", message: "Sign in with the right staff account to do this.", status: 403 } },
      { status: 403 }
    );
  }
  if (user.role !== "super_admin" && !user.cafeId) {
    return NextResponse.json(
      { error: { code: "NOT_SCOPED", message: "This account isn't assigned to a cafe yet.", status: 403 } },
      { status: 403 }
    );
  }
  return { user };
}

// The cafeId a merchant/admin/cashier session is allowed to act on, or
// undefined for an unrestricted super_admin session — pass straight into
// store.ts's authorizedCafeId-style params.
export function scopedCafeId(user: SessionUser): number | undefined {
  return user.role === "super_admin" ? undefined : user.cafeId;
}

// For routes that already know the target cafeId up front (from the URL) —
// checks it against the session's cafe scope before doing anything else.
// Routes where the cafe is only known *after* a DB lookup (an item id, a
// floor id, a table id) instead pass scopedCafeId() into the store.ts
// function and let it reject inside the same query/transaction — see
// posAction's authorizedCafeId and saveFloorLayout's authorizedCafeId.
export function assertCafeMatch(user: SessionUser, cafeId: number): NextResponse | null {
  const restricted = scopedCafeId(user);
  if (restricted !== undefined && restricted !== cafeId) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "This belongs to another cafe.", status: 403 } },
      { status: 403 }
    );
  }
  return null;
}

// /api/admin/* — cafe and staff-account CRUD is platform-level (crosses
// every cafe), so it's gated to super_admin only, separate from the
// per-cafe merchant/admin/cashier roles above.
export async function requireSuperAdmin(req: NextRequest): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getSession(req);
  if (!user || user.role !== "super_admin") {
    return NextResponse.json(
      { error: { code: "SUPER_ADMIN_ONLY", message: "Sign in as super admin.", status: 403 } },
      { status: 403 }
    );
  }
  return { user };
}
