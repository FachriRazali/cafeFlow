import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserForLogin, touchLastLogin } from "@/lib/store";
import { createSessionCookieValue, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Email and password are required", status: 400 } },
      { status: 400 }
    );
  }

  const user = await findUserForLogin(email);
  const ok = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json(
      { error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect.", status: 401 } },
      { status: 401 }
    );
  }

  await touchLastLogin(user.id);
  // merchant/admin/cashier are all scoped to exactly one cafe now — only
  // super_admin and customer sessions carry no cafeId.
  const isCafeScopedRole = user.role === "merchant" || user.role === "admin" || user.role === "cashier";
  const sessionUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    ...(isCafeScopedRole && user.cafeId ? { cafeId: user.cafeId } : {})
  };
  const res = NextResponse.json({ user: sessionUser });
  res.cookies.set(SESSION_COOKIE_NAME, await createSessionCookieValue(sessionUser), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/"
  });
  return res;
}
