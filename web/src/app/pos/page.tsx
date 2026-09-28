"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { POSDashboard } from "@/components/pos/POSDashboard";
import { ArrowLeft, Loader2, ScanLine } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AuthStatus } from "@/components/ui/AuthStatus";

interface SessionUser {
  id: number;
  fullName: string;
  email: string;
  role: "super_admin" | "admin" | "merchant" | "cashier" | "customer";
  cafeId?: number;
}

export default function PosPage() {
  const [session, setSession] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setSession(data.user ?? null))
      .catch(() => setSession(null));
  }, []);

  // Both cashier and admin are now cafe-scoped via cafe_staff — the session
  // carries which one cafe this account may act on.
  const cafeId = session?.role === "cashier" || session?.role === "admin" ? session.cafeId : undefined;

  return (
    <main className="min-h-screen bg-ink-50 pb-16">
      <header className="border-b border-ink-100 bg-surface">
        <div className="mx-auto flex max-w-6xl items-start justify-between px-4 py-4 sm:px-6">
          <div>
            <Link href="/" className="flex items-center gap-1.5 text-xs font-semibold text-ink-400 hover:text-ink-700">
              <ArrowLeft size={13} /> Back to CafeFlow
            </Link>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-extrabold text-ink-900">
              <ScanLine size={20} className="text-brand-600" /> Cashier POS
            </h1>
            <p className="text-sm text-ink-500">
              {session ? `Signed in as ${session.email}` : "Live table grid for your cafe"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AuthStatus />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        {session === undefined ? (
          <div className="flex items-center gap-2 py-16 text-sm text-ink-400">
            <Loader2 size={16} className="animate-spin" /> Loading your cafe…
          </div>
        ) : cafeId ? (
          <POSDashboard cafeId={cafeId} />
        ) : (
          <p className="py-16 text-center text-sm text-ink-500">
            Your account isn't assigned to a cafe yet. Ask your super admin to set this up.
          </p>
        )}
      </div>
    </main>
  );
}
