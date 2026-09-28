import { NextRequest, NextResponse } from "next/server";
import { confirmPayment } from "@/lib/store";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { payment, reservation } = await confirmPayment(Number(params.id));
    return NextResponse.json({ payment, reservation });
  } catch {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payment not found", status: 404 } }, { status: 404 });
  }
}
