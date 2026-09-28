import { NextRequest, NextResponse } from "next/server";
import { getCafe, getFloors } from "@/lib/store";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const sp = req.nextUrl.searchParams;
  const lat = sp.get("lat") ? Number(sp.get("lat")) : undefined;
  const lng = sp.get("lng") ? Number(sp.get("lng")) : undefined;
  const origin = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;

  const cafe = await getCafe(id, origin);
  if (!cafe) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Cafe not found", status: 404 } }, { status: 404 });
  }
  const floors = await getFloors(id);
  return NextResponse.json({ ...cafe, floors });
}
