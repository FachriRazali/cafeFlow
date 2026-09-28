import { NextResponse } from "next/server";
import { getNotificationLogs } from "@/lib/store";

// This route reads mutable state (grows on every payment confirmation / POS
// check-in), so it must never be statically cached — without this, `next
// build` would freeze the response at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ data: await getNotificationLogs() });
}
