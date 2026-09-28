import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { setMenuDocument } from "@/lib/store";
import { assertCafeMatch, requireStaffSession } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB — a menu scan/photo, not a media library

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireStaffSession(req, { roles: ["cashier", "admin"] });
  if (gate instanceof NextResponse) return gate;
  const cafeId = Number(params.id);
  const denied = assertCafeMatch(gate.user, cafeId);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { code: "INVALID_BODY", message: "file is required", status: 400 } }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_TYPE", message: "Only PDF, PNG, JPG or WEBP files are accepted.", status: 400 } },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: { code: "TOO_LARGE", message: "File is larger than 8MB.", status: 400 } },
      { status: 400 }
    );
  }

  const type: "pdf" | "image" = file.type === "application/pdf" ? "pdf" : "image";
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `cafe-${cafeId}-menu-${Date.now()}.${ext}`;
  // Deliberately NOT under public/ — Next.js snapshots that folder's file
  // list once at server boot, so a file written there mid-process 404s until
  // the next restart. Serving through our own route stays live immediately.
  const dir = path.join(process.cwd(), "uploads", "menus");
  await mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);

  const url = `/api/uploads/menus/${filename}`;
  await setMenuDocument(cafeId, url, type);
  return NextResponse.json({ menuDocumentUrl: url, menuDocumentType: type });
}
