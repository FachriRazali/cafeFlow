"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, UserRound } from "@/components/ui/icons";

interface SessionUser {
  id: number;
  fullName: string;
  email: string;
  role: "super_admin" | "admin" | "merchant" | "cashier" | "customer";
}

/** Small "who's signed in" chip for page headers — shared by the customer,
 * merchant and POS layouts so the login state reads the same everywhere. */
export function AuthStatus() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (user === undefined) return <div className="h-9 w-20" />;

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-200"
      >
        <LogIn size={13} /> Staff login
      </Link>
    );
  }

  return (
    <button
      onClick={logout}
      title="Sign out"
      className="flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-200"
    >
      <UserRound size={13} /> {user.fullName} · {user.role} · Sign out
    </button>
  );
}
