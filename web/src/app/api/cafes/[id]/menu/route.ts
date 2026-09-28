import { NextRequest, NextResponse } from "next/server";
import { createMenuItem, getMenuItems } from "@/lib/store";
import { assertCafeMatch, requireStaffSession } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const items = await getMenuItems(Number(params.id));
  return NextResponse.json({ data: items });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireStaffSession(req, { roles: ["cashier", "admin"] });
  if (gate instanceof NextResponse) return gate;
  const cafeId = Number(params.id);
  const denied = assertCafeMatch(gate.user, cafeId);
  if (denied) return denied;

  const body = await req.json();
  if (!body.name || body.price === undefined) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "name and price are required", status: 400 } },
      { status: 400 }
    );
  }
  const item = await createMenuItem({
    cafeId,
    name: String(body.name),
    description: body.description ? String(body.description) : undefined,
    price: Number(body.price),
    category: body.category ? String(body.category) : "Food",
    imageUrl: body.imageUrl ? String(body.imageUrl) : undefined,
    isAvailable: body.isAvailable ?? true
  });
  return NextResponse.json(item);
}
