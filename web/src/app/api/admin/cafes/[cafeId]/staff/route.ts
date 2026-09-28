import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createStaffAccount, listStaffForCafe, StaffRole } from "@/lib/store";
import { requireSuperAdmin } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

const VALID_ROLES: StaffRole[] = ["merchant", "admin", "cashier"];

export async function GET(req: NextRequest, { params }: { params: { cafeId: string } }) {
  const gate = await requireSuperAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const staff = await listStaffForCafe(Number(params.cafeId));
  return NextResponse.json({ data: staff });
}

export async function POST(req: NextRequest, { params }: { params: { cafeId: string } }) {
  const gate = await requireSuperAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = await req.json();
  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const role = body.role as StaffRole;

  if (!fullName || !email || password.length < 6 || !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message: "Name, email, a password (6+ chars) and a valid role (merchant/admin/cashier) are required.",
          status: 400
        }
      },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const account = await createStaffAccount({ cafeId: Number(params.cafeId), role, fullName, email, passwordHash });
    return NextResponse.json({ data: account }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "UNKNOWN";
    const status = message === "NOT_FOUND" ? 404 : message === "EMAIL_TAKEN" ? 409 : 400;
    const friendly =
      message === "NOT_FOUND"
        ? "Cafe not found."
        : message === "EMAIL_TAKEN"
          ? "That email is already registered to another account."
          : "Could not create account.";
    return NextResponse.json({ error: { code: message, message: friendly, status } }, { status });
  }
}
