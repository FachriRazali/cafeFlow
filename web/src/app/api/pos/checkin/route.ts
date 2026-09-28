import { NextRequest, NextResponse } from "next/server";
import { getReservationByToken, posAction } from "@/lib/store";
import { requireStaffSession, scopedCafeId } from "@/lib/staffAuth";

export async function POST(req: NextRequest) {
  const gate = await requireStaffSession(req, { roles: ["cashier", "admin"] });
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json()) as { qrPayload: string };
  // Client sends `cafeflow://ticket/<qr_code_token>` — the token is the
  // opaque, unguessable string the DB generated at reservation time.
  const token = body.qrPayload.split("/").pop() ?? "";
  const reservation = await getReservationByToken(token);
  if (!reservation || !reservation.tableId) {
    return NextResponse.json({ error: { code: "INVALID_TICKET", message: "QR ticket not recognized", status: 404 } }, { status: 404 });
  }

  const restricted = scopedCafeId(gate.user);
  if (restricted !== undefined && restricted !== reservation.cafeId) {
    return NextResponse.json(
      { error: { code: "INVALID_TICKET", message: "QR ticket not recognized", status: 404 } },
      { status: 404 }
    );
  }

  try {
    const table = await posAction(reservation.tableId, "check_in_qr", {
      authorizedCafeId: restricted,
      cashierUserId: gate.user.id
    });
    return NextResponse.json({ table, reservation });
  } catch {
    return NextResponse.json({ error: { code: "INVALID_TICKET", message: "QR ticket not recognized", status: 404 } }, { status: 404 });
  }
}
