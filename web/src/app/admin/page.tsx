"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AuthStatus } from "@/components/ui/AuthStatus";
import { ArrowLeft, Loader2, Plus, ShieldCheck, Trash2, UserPlus } from "@/components/ui/icons";

interface District {
  id: number;
  city: string;
  name: string;
}

interface CafeOption {
  id: number;
  name: string;
  isActive: boolean;
}

type StaffRole = "merchant" | "admin" | "cashier";

interface StaffAccount {
  id: number;
  fullName: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABEL: Record<StaffRole, string> = {
  merchant: "Merchant",
  admin: "Admin",
  cashier: "Cashier"
};

export default function AdminPage() {
  const [cafes, setCafes] = useState<CafeOption[] | null>(null);
  const [selectedCafeId, setSelectedCafeId] = useState<number | null>(null);
  const [staff, setStaff] = useState<StaffAccount[] | null>(null);
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [cafeFormOpen, setCafeFormOpen] = useState(false);

  async function refreshCafes(selectId?: number) {
    const res = await fetch("/api/admin/cafes");
    const data = await res.json();
    setCafes(data.data ?? []);
    if (selectId) setSelectedCafeId(selectId);
    else if (!selectedCafeId && data.data?.[0]) setSelectedCafeId(data.data[0].id);
  }

  useEffect(() => {
    refreshCafes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshStaff(cafeId: number) {
    setStaff(null);
    const res = await fetch(`/api/admin/cafes/${cafeId}/staff`);
    const data = await res.json();
    setStaff(data.data ?? []);
  }

  useEffect(() => {
    if (selectedCafeId) refreshStaff(selectedCafeId);
  }, [selectedCafeId]);

  async function toggleCafeActive(cafe: CafeOption) {
    await fetch(`/api/admin/cafes/${cafe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cafe.isActive })
    });
    refreshCafes();
  }

  async function toggleActive(userId: number, isActive: boolean) {
    await fetch(`/api/admin/staff/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive })
    });
    if (selectedCafeId) refreshStaff(selectedCafeId);
  }

  async function removeStaff(userId: number) {
    if (!confirm("Deactivate this account? They will no longer be able to sign in.")) return;
    await fetch(`/api/admin/staff/${userId}`, { method: "DELETE" });
    if (selectedCafeId) refreshStaff(selectedCafeId);
  }

  const selectedCafe = cafes?.find((c) => c.id === selectedCafeId) ?? null;

  return (
    <main className="min-h-screen bg-ink-50 pb-16">
      <header className="border-b border-ink-100 bg-surface">
        <div className="mx-auto flex max-w-4xl items-start justify-between px-4 py-4 sm:px-6">
          <div>
            <Link href="/" className="flex items-center gap-1.5 text-xs font-semibold text-ink-400 hover:text-ink-700">
              <ArrowLeft size={13} /> Back to CafeFlow
            </Link>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-extrabold text-ink-900">
              <ShieldCheck size={20} className="text-brand-600" /> Super Admin
            </h1>
            <p className="text-sm text-ink-500">Add cafes, and create merchant/admin/cashier accounts scoped to each one.</p>
          </div>
          <div className="flex items-center gap-2">
            <AuthStatus />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6">
        {cafes === null ? (
          <div className="flex items-center gap-2 py-16 text-sm text-ink-400">
            <Loader2 size={16} className="animate-spin" /> Loading cafes…
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-2xl bg-surface p-5 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink-900">Cafes</h2>
                <button
                  onClick={() => setCafeFormOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700"
                >
                  <Plus size={13} /> New cafe
                </button>
              </div>

              {cafeFormOpen && (
                <NewCafeForm
                  onCreated={(id) => {
                    setCafeFormOpen(false);
                    refreshCafes(id);
                  }}
                />
              )}

              <div className="flex flex-wrap gap-2">
                {cafes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCafeId(c.id)}
                    className={
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
                      (c.id === selectedCafeId
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-ink-100 text-ink-600 hover:border-ink-200")
                    }
                  >
                    {c.name}
                    {!c.isActive && <span className="text-ink-400">(inactive)</span>}
                  </button>
                ))}
              </div>

              {selectedCafe && (
                <button
                  onClick={() => toggleCafeActive(selectedCafe)}
                  className="mt-3 rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50"
                >
                  {selectedCafe.isActive ? "Deactivate this cafe" : "Reactivate this cafe"}
                </button>
              )}
            </div>

            {selectedCafeId && (
              <div className="rounded-2xl bg-surface p-5 shadow-soft">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink-900">Staff accounts — {selectedCafe?.name}</h2>
                  <button
                    onClick={() => setStaffFormOpen((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-2 text-xs font-bold text-white hover:bg-ink-800"
                  >
                    <Plus size={13} /> New account
                  </button>
                </div>

                {staffFormOpen && (
                  <NewStaffForm
                    cafeId={selectedCafeId}
                    onCreated={() => {
                      setStaffFormOpen(false);
                      refreshStaff(selectedCafeId);
                    }}
                  />
                )}

                {staff === null ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-ink-400">
                    <Loader2 size={16} className="animate-spin" /> Loading…
                  </div>
                ) : staff.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-400">No staff accounts for this cafe yet.</p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {staff.map((s) => (
                      <li key={s.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                            {s.fullName}
                            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
                              {ROLE_LABEL[s.role]}
                            </span>
                          </p>
                          <p className="text-xs text-ink-500">{s.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "rounded-full px-2 py-0.5 text-[10px] font-bold " +
                              (s.isActive ? "bg-capacity-green/15 text-capacity-green" : "bg-ink-100 text-ink-400")
                            }
                          >
                            {s.isActive ? "Active" : "Deactivated"}
                          </span>
                          <button
                            onClick={() => toggleActive(s.id, s.isActive)}
                            className="rounded-lg border border-ink-100 px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50"
                          >
                            {s.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                          <button
                            onClick={() => removeStaff(s.id)}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-capacity-red/10 hover:text-capacity-red"
                            title="Deactivate"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function NewCafeForm({ onCreated }: { onCreated: (cafeId: number) => void }) {
  const [districts, setDistricts] = useState<District[] | null>(null);
  const [name, setName] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/districts")
      .then((r) => r.json())
      .then((d) => {
        setDistricts(d.data ?? []);
        if (d.data?.[0]) setDistrictId(String(d.data[0].id));
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cafes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          districtId: Number(districtId),
          address,
          latitude: Number(latitude),
          longitude: Number(longitude),
          whatsappNumber
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Could not create cafe.");
      onCreated(data.data.id);
      setName("");
      setAddress("");
      setLatitude("");
      setLongitude("");
      setWhatsappNumber("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create cafe.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 space-y-2 rounded-xl border border-dashed border-ink-200 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          required
          placeholder="Cafe name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <select
          value={districtId}
          onChange={(e) => setDistrictId(e.target.value)}
          className="rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          {districts === null ? (
            <option>Loading districts…</option>
          ) : (
            districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}, {d.city}
              </option>
            ))
          )}
        </select>
      </div>
      <input
        required
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          required
          type="number"
          step="any"
          placeholder="Latitude"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          className="rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          required
          type="number"
          step="any"
          placeholder="Longitude"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          className="rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          required
          placeholder="WhatsApp number"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
          className="rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      {error && <p className="text-xs font-semibold text-capacity-red">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Create cafe
      </button>
      <p className="text-[11px] text-ink-400">Tip: right-click a spot on Google Maps to copy its exact lat/long.</p>
    </form>
  );
}

function NewStaffForm({ cafeId, onCreated }: { cafeId: number; onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("cashier");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cafes/${cafeId}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Could not create account.");
      setFullName("");
      setEmail("");
      setPassword("");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 space-y-2 rounded-xl border border-dashed border-ink-200 p-4">
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          required
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none sm:col-span-1"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none sm:col-span-1"
        />
        <input
          required
          type="password"
          placeholder="Password (6+ chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none sm:col-span-1"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          className="rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none sm:col-span-1"
        >
          <option value="merchant">Merchant</option>
          <option value="admin">Admin</option>
          <option value="cashier">Cashier</option>
        </select>
      </div>
      {error && <p className="text-xs font-semibold text-capacity-red">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-2 text-xs font-bold text-white hover:bg-ink-800 disabled:opacity-50"
      >
        {submitting ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
        Create account
      </button>
    </form>
  );
}
