import { NextRequest, NextResponse } from "next/server";
import { createReservation } from "@/lib/store";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Never trust a client-supplied userId — derive "registered" from the
  // actual session cookie, otherwise this is just a guest reservation.
  // (Without this, anyone could POST an arbitrary userId and book under
  // someone else's account.)
  const session = await getSession(req);
  try {
    const { reservation, payment } = await createReservation({
      cafeId: body.cafeId,
      tableId: body.tableId,
      partySize: body.partySize,
      slotMinutes: body.slotMinutes,
      startTime: body.startTime,
      guestName: body.guest?.name,
      guestWhatsapp: body.guest?.whatsapp,
      userId: session?.id
    });
    return NextResponse.json({
      reservationId: reservation.id,
      reservationCode: reservation.reservationCode,
      status: reservation.status,
      qrCodeToken: reservation.qrCodeToken,
      payment: payment
        ? { id: payment.id, amount: payment.amount, currency: payment.currency, holdExpiresAt: payment.holdExpiresAt }
        : null
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "UNKNOWN";
    const status = message === "TABLE_ALREADY_RESERVED" ? 409 : message === "NOT_FOUND" || message === "INVALID_USER" ? 404 : 400;
    const friendly =
      message === "TABLE_ALREADY_RESERVED"
        ? "This table was just reserved by someone else. Please pick another seat."
        : message === "INVALID_USER"
          ? "Your account could not be found. Please reserve as a guest instead."
          : "Could not create reservation.";
    return NextResponse.json({ error: { code: message, message: friendly, status } }, { status });
  }
}
