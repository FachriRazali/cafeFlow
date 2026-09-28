import { NextRequest, NextResponse } from "next/server";
import { updateCafeStatus } from "@/lib/store";
import { requireSuperAdmin } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { cafeId: string } }) {
  const gate = await requireSuperAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = await req.json();
  if (typeof body.isActive !== "boolean") {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "isActive (boolean) is required.", status: 400 } },
      { status: 400 }
    );
  }
  await updateCafeStatus(Number(params.cafeId), body.isActive);
  return NextResponse.json({ ok: true });
}
