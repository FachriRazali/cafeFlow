import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { deactivateStaffAccount, updateStaffAccount } from "@/lib/store";
import { requireSuperAdmin } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  const gate = await requireSuperAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = await req.json();
  const patch: { fullName?: string; passwordHash?: string; isActive?: boolean } = {};
  if (typeof body.fullName === "string" && body.fullName.trim()) patch.fullName = body.fullName.trim();
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: { code: "INVALID_BODY", message: "Password must be at least 6 characters.", status: 400 } },
        { status: 400 }
      );
    }
    patch.passwordHash = await bcrypt.hash(body.password, 10);
  }
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;

  await updateStaffAccount(Number(params.userId), patch);
  return NextResponse.json({ ok: true });
}

// Soft-delete (is_active = false) — see store.ts's deactivateStaffAccount for why.
export async function DELETE(req: NextRequest, { params }: { params: { userId: string } }) {
  const gate = await requireSuperAdmin(req);
  if (gate instanceof NextResponse) return gate;
  await deactivateStaffAccount(Number(params.userId));
  return NextResponse.json({ ok: true });
}
