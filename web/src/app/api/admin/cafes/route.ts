import { NextRequest, NextResponse } from "next/server";
import { createCafe, listCafesForAdmin } from "@/lib/store";
import { requireSuperAdmin } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const cafes = await listCafesForAdmin();
  return NextResponse.json({ data: cafes });
}

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const address = String(body.address ?? "").trim();
  const whatsappNumber = String(body.whatsappNumber ?? "").trim();
  const districtId = Number(body.districtId);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);

  if (!name || !address || !whatsappNumber || !districtId || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message: "name, address, whatsappNumber, districtId, latitude and longitude are required.",
          status: 400
        }
      },
      { status: 400 }
    );
  }

  const cafe = await createCafe({
    name,
    address,
    whatsappNumber,
    districtId,
    latitude,
    longitude,
    priceTier: body.priceTier,
    description: body.description ? String(body.description) : undefined
  });
  return NextResponse.json({ data: cafe }, { status: 201 });
}
