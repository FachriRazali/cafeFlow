import { NextRequest, NextResponse } from "next/server";
import { listCafes } from "@/lib/store";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = sp.get("lat") ? Number(sp.get("lat")) : undefined;
  const lng = sp.get("lng") ? Number(sp.get("lng")) : undefined;
  const districtId = sp.get("district_id") ? Number(sp.get("district_id")) : undefined;
  const priceTiers = sp.getAll("price_tier");
  const sort = (sp.get("sort") as "popularity" | "distance" | "availability" | null) ?? undefined;
  const availability = (sp.get("availability") as "green" | "yellow" | "red" | "any" | null) ?? undefined;
  const q = sp.get("q") ?? undefined;

  const data = await listCafes({ lat, lng, districtId, priceTiers: priceTiers.length ? priceTiers : undefined, sort, availability, q });
  return NextResponse.json({ data, total: data.length });
}
