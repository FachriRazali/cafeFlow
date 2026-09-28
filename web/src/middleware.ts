import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Merchant/cashier/admin areas require a real login now (see /login) instead
// of the customer-page PIN toggle this replaced. Guest/customer browsing at
// "/" and "/cafe/*" stays open to everyone.
const RULES: { prefix: string; roles: Array<"super_admin" | "admin" | "merchant" | "cashier" | "customer"> }[] = [
  { prefix: "/merchant", roles: ["merchant", "admin"] },
  { prefix: "/pos", roles: ["cashier", "admin"] },
  { prefix: "/admin", roles: ["super_admin"] }
];

export async function middleware(req: NextRequest) {
  const rule = RULES.find((r) => req.nextUrl.pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const user = await getSession(req);
  if (!user || !rule.roles.includes(user.role)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/merchant/:path*", "/pos/:path*", "/admin/:path*"]
};
