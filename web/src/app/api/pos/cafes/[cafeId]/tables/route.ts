import { NextRequest, NextResponse } from "next/server";
import { posListTables } from "@/lib/store";
import { assertCafeMatch, requireStaffSession } from "@/lib/staffAuth";

export async function GET(req: NextRequest, { params }: { params: { cafeId: string } }) {
  const gate = await requireStaffSession(req, { roles: ["cashier", "admin"] });
  if (gate instanceof NextResponse) return gate;
  const cafeId = Number(params.cafeId);
  const denied = assertCafeMatch(gate.user, cafeId);
  if (denied) return denied;
  const tables = await posListTables(cafeId);
  return NextResponse.json({ data: tables });
}
