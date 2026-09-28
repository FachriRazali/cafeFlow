import { NextRequest, NextResponse } from "next/server";
import { cancelReservation } from "@/lib/store";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const reservation = await cancelReservation(Number(params.id));
    return NextResponse.json({ reservation });
  } catch {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Reservation not found", status: 404 } }, { status: 404 });
  }
}
