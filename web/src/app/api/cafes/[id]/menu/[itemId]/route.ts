import { NextRequest, NextResponse } from "next/server";
import { deleteMenuItem, updateMenuItem } from "@/lib/store";
import { assertCafeMatch, requireStaffSession } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const gate = await requireStaffSession(req, { roles: ["cashier", "admin"] });
  if (gate instanceof NextResponse) return gate;
  const cafeId = Number(params.id);
  const denied = assertCafeMatch(gate.user, cafeId);
  if (denied) return denied;

  const body = await req.json();
  const item = await updateMenuItem(Number(params.itemId), cafeId, {
    name: body.name,
    description: body.description,
    price: body.price !== undefined ? Number(body.price) : undefined,
    category: body.category,
    imageUrl: body.imageUrl,
    isAvailable: body.isAvailable
  });
  if (!item) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Menu item not found", status: 404 } }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const gate = await requireStaffSession(req, { roles: ["cashier", "admin"] });
  if (gate instanceof NextResponse) return gate;
  const cafeId = Number(params.id);
  const denied = assertCafeMatch(gate.user, cafeId);
  if (denied) return denied;

  const ok = await deleteMenuItem(Number(params.itemId), cafeId);
  if (!ok) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Menu item not found", status: 404 } }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
