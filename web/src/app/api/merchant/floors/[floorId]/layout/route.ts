import { NextRequest, NextResponse } from "next/server";
import { saveFloorLayout } from "@/lib/store";
import { TableShape } from "@/lib/types";
import { requireStaffSession, scopedCafeId } from "@/lib/staffAuth";

interface LayoutTableInput {
  tableCode: string;
  shape: TableShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  capacity: number;
}

export async function PUT(req: NextRequest, { params }: { params: { floorId: string } }) {
  const gate = await requireStaffSession(req, { roles: ["merchant", "admin"] });
  if (gate instanceof NextResponse) return gate;

  const floorId = Number(params.floorId);
  const body = (await req.json()) as { tables: LayoutTableInput[] };

  try {
    const floor = await saveFloorLayout(
      floorId,
      body.tables.map((t) => ({
        tableCode: t.tableCode,
        shape: t.shape,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
        capacity: t.capacity
      })),
      scopedCafeId(gate.user)
    );

    if (!floor) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Floor not found", status: 404 } }, { status: 404 });
    }
    return NextResponse.json({ floorId: floor.id, tables: floor.tables });
  } catch (e) {
    const message = e instanceof Error ? e.message : "UNKNOWN";
    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "This floor belongs to another cafe.", status: 403 } },
        { status: 403 }
      );
    }
    throw e;
  }
}
