"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Cafe, CafeTable } from "@/lib/types";
import { useCountdown } from "./useCountdown";
import { QrTicket } from "./QrTicket";
import {
  X,
  Users,
  Clock,
  UserRound,
  LogIn,
  Wallet,
  QrCode,
  CircleCheck,
  Bell,
  Loader2,
  Timer
} from "@/components/ui/icons";

type Step = "details" | "identity" | "payment" | "ticket";

interface SessionUser {
  id: number;
  fullName: string;
  email: string;
  role: "admin" | "merchant" | "cashier" | "customer";
}

interface ReservationResult {
  reservationId: number;
  reservationCode: string;
  status: string;
  qrCodeToken: string;
  payment: { id: number; amount: number; currency: string; holdExpiresAt: string } | null;
}

export function ReservationModal({ cafe, table, onClose }: { cafe: Cafe; table: CafeTable; onClose: () => void }) {
  const [step, setStep] = useState<Step>("details");
  const [partySize, setPartySize] = useState(Math.min(2, table.capacity));
  const [slotMinutes, setSlotMinutes] = useState<90 | 120>(cafe.defaultSlotMinutes === 120 ? 120 : 90);
  const [startHour, setStartHour] = useState(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    return now;
  });
  const [mode, setMode] = useState<"guest" | "registered">("guest");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReservationResult | null>(null);
  const [paying, setPaying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [session, setSession] = useState<SessionUser | null | undefined>(undefined); // undefined = still loading

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setSession(d.user ?? null))
      .catch(() => setSession(null));
  }, []);

  const countdown = useCountdown(result?.payment?.holdExpiresAt ?? null);

  async function submitReservation() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafeId: cafe.id,
          tableId: table.id,
          partySize,
          slotMinutes,
          startTime: startHour.toISOString(),
          guest: mode === "guest" ? { name, whatsapp } : undefined,
          userId: mode === "registered" ? session?.id : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Could not reserve this table.");
      setResult(data);
      setStep(data.payment ? "payment" : "ticket");
      if (!data.payment) fireNotifications();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function payNow() {
    if (!result?.payment) return;
    setPaying(true);
    await new Promise((r) => setTimeout(r, 900)); // simulate gateway round trip
    await fetch(`/api/payments/${result.payment.id}/confirm`, { method: "POST" });
    setPaying(false);
    setStep("ticket");
    fireNotifications();
  }

  function fireNotifications() {
    setNotified(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 backdrop-blur-sm sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface shadow-floating sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{cafe.name}</p>
            <h2 className="text-lg font-bold text-ink-900">Table {table.tableCode}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-ink-400 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <AnimatePresence mode="wait">
            {step === "details" && (
              <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <Field label="Party size" icon={<Users size={15} />}>
                  <div className="flex items-center gap-3">
                    <StepperButton onClick={() => setPartySize((p) => Math.max(1, p - 1))} label="−" />
                    <span className="w-8 text-center text-lg font-bold text-ink-900">{partySize}</span>
                    <StepperButton onClick={() => setPartySize((p) => Math.min(table.capacity, p + 1))} label="+" />
                    <span className="text-xs text-ink-400">max {table.capacity}</span>
                  </div>
                </Field>

                <Field label="Time slot" icon={<Clock size={15} />}>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={`${String(startHour.getHours()).padStart(2, "0")}:00`}
                      onChange={(e) => {
                        const [h] = e.target.value.split(":").map(Number);
                        const next = new Date(startHour);
                        next.setHours(h);
                        setStartHour(next);
                      }}
                      className="rounded-lg border border-ink-100 px-3 py-2 text-sm font-semibold text-ink-900"
                    />
                    <div className="flex overflow-hidden rounded-lg border border-ink-100 text-sm font-semibold">
                      {[90, 120].map((m) => (
                        <button
                          key={m}
                          onClick={() => setSlotMinutes(m as 90 | 120)}
                          className={
                            slotMinutes === m ? "bg-ink-900 px-3 py-2 text-white" : "bg-surface px-3 py-2 text-ink-600 hover:bg-ink-50"
                          }
                        >
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-400">
                    Auto-cancelled if you don't check in within {cafe.gracePeriodMinutes} minutes of your slot.
                  </p>
                </Field>

                <button
                  onClick={() => setStep("identity")}
                  className="w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
                >
                  Continue
                </button>
              </motion.div>
            )}

            {step === "identity" && (
              <motion.div key="identity" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex rounded-xl bg-ink-50 p-1">
                  <TabButton active={mode === "guest"} onClick={() => setMode("guest")} icon={<UserRound size={14} />} label="Guest" />
                  <TabButton
                    active={mode === "registered"}
                    onClick={() => setMode("registered")}
                    icon={<LogIn size={14} />}
                    label="Sign in"
                  />
                </div>

                {mode === "guest" ? (
                  <div className="space-y-3">
                    <LabeledInput label="Full name" value={name} onChange={setName} placeholder="Bunga Larasati" />
                    <LabeledInput label="WhatsApp number" value={whatsapp} onChange={setWhatsapp} placeholder="+62 812 xxxx xxxx" />
                    <p className="text-xs text-ink-400">Your QR ticket and reminder will be sent to this WhatsApp number.</p>
                  </div>
                ) : session === undefined ? (
                  <div className="rounded-xl border border-dashed border-ink-100 bg-ink-50/60 p-4 text-center text-sm text-ink-400">
                    Checking your session…
                  </div>
                ) : session ? (
                  <div className="rounded-xl border border-dashed border-ink-100 bg-ink-50/60 p-4 text-center text-sm text-ink-600">
                    Signed in as <strong>{session.email}</strong> — ticket and reminders go to your account.
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-ink-100 bg-ink-50/60 p-4 text-center text-sm text-ink-600">
                    <p className="mb-2">You're not signed in.</p>
                    <Link href="/login" className="font-semibold text-brand-600 hover:underline">
                      Go to login →
                    </Link>
                    <p className="mt-2 text-xs text-ink-400">Or switch to the Guest tab — no account needed.</p>
                  </div>
                )}

                {error && <p className="text-sm font-medium text-capacity-red">{error}</p>}

                <button
                  onClick={submitReservation}
                  disabled={
                    submitting ||
                    (mode === "guest" && (!name || !whatsapp)) ||
                    (mode === "registered" && !session)
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {cafe.requiresDownPayment ? `Reserve · pay ${formatIDR(cafe.dpAmount)} DP` : "Reserve — no payment needed"}
                </button>
              </motion.div>
            )}

            {step === "payment" && result?.payment && (
              <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className="rounded-2xl bg-ink-900 p-5 text-white">
                  <div className="flex items-center justify-between text-sm text-brand-100/80">
                    <span className="flex items-center gap-1.5">
                      <Wallet size={14} /> Down payment
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-base font-bold text-white">
                      <Timer size={14} />
                      {String(countdown.minutes).padStart(2, "0")}:{String(countdown.seconds).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-3 text-3xl font-extrabold">{formatIDR(result.payment.amount)}</p>
                  <p className="mt-1 text-xs text-brand-100/70">
                    {countdown.expired
                      ? "Hold expired — this table has been released. Please start over."
                      : "Complete payment before the hold expires or your table is released automatically."}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-ink-600">
                  {["QRIS", "Virtual Account", "E-Wallet"].map((m) => (
                    <div key={m} className="rounded-lg border border-ink-100 py-2">
                      {m}
                    </div>
                  ))}
                </div>

                <button
                  onClick={payNow}
                  disabled={paying || countdown.expired}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-capacity-green py-3 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  {paying ? <Loader2 size={16} className="animate-spin" /> : <CircleCheck size={16} />}
                  {paying ? "Confirming payment…" : "Simulate payment success"}
                </button>
              </motion.div>
            )}

            {step === "ticket" && result && (
              <motion.div
                key="ticket"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div className="flex items-center gap-2 rounded-full bg-capacity-greenBg px-4 py-1.5 text-sm font-bold text-capacity-green">
                  <CircleCheck size={16} /> Reservation confirmed
                </div>
                <QrTicket payload={`cafeflow://ticket/${result.qrCodeToken}`} />
                <div>
                  <p className="text-lg font-bold text-ink-900">{result.reservationCode}</p>
                  <p className="text-sm text-ink-600">
                    Table {table.tableCode} · {partySize} guests · {slotMinutes} min
                  </p>
                  <p className="text-xs text-ink-400">
                    {startHour.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} today
                  </p>
                </div>

                {notified && (
                  <div className="w-full space-y-2 rounded-xl bg-ink-50 p-3 text-left text-xs text-ink-600">
                    <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                      <Bell size={13} /> Notifications sent
                    </p>
                    <p>✅ WhatsApp: QR ticket delivered to {mode === "guest" ? whatsapp : "your account number"}</p>
                    <p>⏰ WhatsApp: H-1 hour reminder scheduled</p>
                    <p>🔔 In-app push queued for your device</p>
                  </div>
                )}

                <button onClick={onClose} className="w-full rounded-xl bg-ink-900 py-3 text-sm font-bold text-white hover:bg-ink-800">
                  Done
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {icon} {label}
      </p>
      {children}
    </div>
  );
}

function StepperButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-lg font-bold text-ink-800 hover:bg-ink-200"
    >
      {label}
    </button>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition " +
        (active ? "bg-surface text-ink-900 shadow-soft" : "text-ink-400")
      }
    >
      {icon} {label}
    </button>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ink-100 px-3 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
      />
    </label>
  );
}
