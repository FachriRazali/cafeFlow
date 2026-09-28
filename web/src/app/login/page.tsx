"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Coffee, Loader2, Lock, UserRound } from "@/components/ui/icons";

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "superadmin@cafeflow.demo", password: "superadmin123" },
  { label: "Merchant", email: "merchant@cafeflow.demo", password: "merchant123" },
  { label: "Cashier", email: "cashier@cafeflow.demo", password: "cashier123" },
  { label: "Admin", email: "admin@cafeflow.demo", password: "admin123" },
  { label: "Customer", email: "fachri@privy.id", password: "customer123" }
];

const ROLE_HOME: Record<string, string> = {
  super_admin: "/admin",
  merchant: "/merchant/builder",
  admin: "/merchant/builder",
  cashier: "/pos",
  customer: "/"
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Login failed.");
      const next = searchParams.get("next");
      router.push(next || ROLE_HOME[data.user.role] || "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-card ring-1 ring-ink-900/5">
        <div className="mb-6 flex items-center gap-2 font-extrabold text-ink-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Coffee size={18} />
          </span>
          CafeFlow
        </div>

        <h1 className="mb-1 text-lg font-bold text-ink-900">Staff login</h1>
        <p className="mb-5 text-sm text-ink-500">Merchant, cashier and admin sign in here. Customers don't need an account to browse or reserve.</p>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-600">
              <UserRound size={13} /> Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@cafeflow.demo"
              className="w-full rounded-lg border border-ink-100 px-3 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-600">
              <Lock size={13} /> Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-ink-100 px-3 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
            />
          </label>

          {error && <p className="text-sm font-medium text-capacity-red">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Sign in
          </button>
        </form>

        <div className="mt-5 border-t border-dashed border-ink-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Demo accounts</p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword(acc.password);
                }}
                className="rounded-lg border border-ink-100 px-2 py-1.5 text-xs font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-600"
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>

        <Link href="/" className="mt-5 block text-center text-xs font-semibold text-ink-400 hover:text-ink-600">
          ← Back to CafeFlow
        </Link>
      </div>
    </main>
  );
}
