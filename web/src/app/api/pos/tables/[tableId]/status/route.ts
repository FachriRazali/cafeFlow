import { NextRequest, NextResponse } from "next/server";
import { posAction } from "@/lib/store";
import { CashierAction } from "@/lib/types";
import { requireStaffSession, scopedCafeId } from "@/lib/staffAuth";

export async function POST(req: NextRequest, { params }: { params: { tableId: string } }) {
  const gate = await requireStaffSession(req, { roles: ["cashier", "admin"] });
  if (gate instanceof NextResponse) return gate;
  const body = (await req.json()) as { action: CashierAction; partySize?: number };
  try {
    const table = await posAction(Number(params.tableId), body.action, {
      partySize: body.partySize,
      authorizedCafeId: scopedCafeId(gate.user),
      cashierUserId: gate.user.id
    });
    return NextResponse.json({ table });
  } catch (e) {
    const message = e instanceof Error ? e.message : "UNKNOWN";
    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "This table belongs to another cafe.", status: 403 } },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Table not found", status: 404 } }, { status: 404 });
  }
}
