import { NextRequest, NextResponse } from "next/server";
import { getLiveCapacity } from "@/lib/store";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const capacity = await getLiveCapacity(id);
  return NextResponse.json({ cafeId: id, ...capacity });
}
