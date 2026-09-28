import { NextRequest } from "next/server";

// Lightweight signed-cookie session — no extra auth library, just an HMAC
// over a small JSON payload. Uses Web Crypto (not Node's `crypto` module) so
// this file works both in ordinary route handlers AND in middleware.ts,
// which Next.js runs on the Edge runtime (no Node `crypto` there).
const COOKIE_NAME = "cf_session";
const SECRET = process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: number;
  fullName: string;
  email: string;
  role: "super_admin" | "admin" | "merchant" | "cashier" | "customer";
  // Set for role "merchant" | "admin" | "cashier" — which single cafe this
  // login is scoped to (from cafe_staff). Every staff-only route must check
  // this against the requested cafeId so an account can never act on
  // another cafe's data. "super_admin" is the only role with no cafeId
  // (platform-wide); "customer" never has one either.
  cafeId?: number;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const str = atob(padded);
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
  return arr;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify"
  ]);
}

async function sign(payload: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(sig);
}

export async function createSessionCookieValue(user: SessionUser): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(user)));
  return `${payload}.${await sign(payload)}`;
}

export async function parseSessionCookieValue(value: string | undefined | null): Promise<SessionUser | null> {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const key = await getKey();
  const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(sig), new TextEncoder().encode(payload));
  if (!valid) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
  } catch {
    return null;
  }
}

export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  return parseSessionCookieValue(req.cookies.get(COOKIE_NAME)?.value);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
