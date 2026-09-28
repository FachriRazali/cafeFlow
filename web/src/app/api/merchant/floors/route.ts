import { NextRequest, NextResponse } from "next/server";
import { createFloor } from "@/lib/store";
import { assertCafeMatch, requireStaffSession } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireStaffSession(req, { roles: ["merchant", "admin"] });
  if (gate instanceof NextResponse) return gate;

  const body = await req.json();
  if (!body.cafeId || !body.name || !body.zoneType || !body.level) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "cafeId, name, zoneType and level are required", status: 400 } },
      { status: 400 }
    );
  }
  const cafeId = Number(body.cafeId);
  const denied = assertCafeMatch(gate.user, cafeId);
  if (denied) return denied;

  const floor = await createFloor({
    cafeId,
    name: String(body.name),
    zoneType: body.zoneType,
    level: Number(body.level),
    canvasWidth: body.canvasWidth ? Number(body.canvasWidth) : undefined,
    canvasHeight: body.canvasHeight ? Number(body.canvasHeight) : undefined
  });
  return NextResponse.json(floor);
}
