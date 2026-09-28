"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { usePolling } from "@/lib/usePolling";
import { CafeTable, Reservation, TableStatus } from "@/lib/types";
import { STATUS_FILL, STATUS_LABEL } from "@/components/floorplan/TableShape";
import { CapacityBadge } from "@/components/ui/CapacityBadge";
import {
  CircleCheck,
  Loader2,
  LogIn,
  QrCode,
  ScanLine,
  Users,
  Wrench,
  X
} from "@/components/ui/icons";

type PosTable = CafeTable & { reservation?: Reservation };

export function POSDashboard({ cafeId }: { cafeId: number }) {
  const [tables, setTables] = useState<PosTable[]>([]);
  const [selected, setSelected] = useState<PosTable | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/pos/cafes/${cafeId}/tables`);
    const data = await res.json();
    setTables(data.data);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafeId]);

  // Cashier view still needs to feel live, but 12s (paused while the tab is
  // hidden) is plenty and cuts request volume by ~60% vs. the old 5s poll.
  usePolling(refresh, 12000);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function runAction(table: PosTable, action: string, label: string) {
    setBusyAction(action);
    await fetch(`/api/pos/tables/${table.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    await refresh();
    setBusyAction(null);
    setSelected(null);
    setToast(`${table.tableCode}: ${label}`);
  }

  const summary = {
    available: tables.filter((t) => t.status === "available").length,
    reserved: tables.filter((t) => t.status === "reserved").length,
    occupied: tables.filter((t) => t.status === "occupied").length
  };
  const occupancyPct = tables.length ? Math.round(((summary.reserved + summary.occupied) / tables.length) * 100) : 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CapacityBadge
            color={occupancyPct > 85 ? "red" : occupancyPct >= 50 ? "yellow" : "green"}
            occupancyPct={occupancyPct}
            size="md"
          />
          <span className="text-sm text-ink-500">
            {summary.available} available · {summary.reserved} reserved · {summary.occupied} occupied
          </span>
        </div>
        <button
          onClick={() => setScannerOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-ink-800"
        >
          <ScanLine size={16} /> Scan QR Check-in
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {tables.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            className="rounded-2xl border-2 bg-surface p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
            style={{ borderColor: STATUS_FILL[t.status] }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-ink-900">{t.tableCode}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: STATUS_FILL[t.status] }}
              >
                {STATUS_LABEL[t.status]}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-ink-500">
              <Users size={12} /> {t.capacity} seats
            </p>
            {t.reservation && (
              <p className="mt-1 truncate text-xs font-semibold text-ink-700">
                {t.reservation.guestName ?? "Registered guest"}
              </p>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-floating" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink-900">Table {selected.tableCode}</h3>
                <p className="text-xs text-ink-400">{selected.capacity} seats · {STATUS_LABEL[selected.status]}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100">
                <X size={18} />
              </button>
            </div>

            {selected.reservation && (
              <div className="mb-4 rounded-xl bg-ink-50 p-3 text-sm">
                <p className="font-semibold text-ink-900">{selected.reservation.guestName ?? "Registered guest"}</p>
                <p className="text-xs text-ink-500">
                  {selected.reservation.reservationCode} · {selected.reservation.partySize} guests
                </p>
              </div>
            )}

            <div className="space-y-2">
              {selected.status === "available" && (
                <ActionButton
                  icon={<Users size={15} />}
                  label="Seat walk-in guests"
                  busy={busyAction === "walk_in_seat"}
                  onClick={() => runAction(selected, "walk_in_seat", "walk-in seated")}
                />
              )}
              {selected.status === "reserved" && (
                <>
                  <ActionButton
                    icon={<LogIn size={15} />}
                    label="Check-in (manual)"
                    busy={busyAction === "check_in_manual"}
                    onClick={() => runAction(selected, "check_in_manual", "checked in")}
                  />
                  <ActionButton
                    icon={<CircleCheck size={15} />}
                    label="Release / mark available"
                    busy={busyAction === "mark_available"}
                    onClick={() => runAction(selected, "mark_available", "released")}
                    variant="ghost"
                  />
                </>
              )}
              {selected.status === "occupied" && (
                <ActionButton
                  icon={<CircleCheck size={15} />}
                  label="Checkout"
                  busy={busyAction === "checkout"}
                  onClick={() => runAction(selected, "checkout", "checked out")}
                />
              )}
              {selected.status !== "maintenance" && (
                <ActionButton
                  icon={<Wrench size={15} />}
                  label="Mark maintenance"
                  busy={busyAction === "mark_maintenance"}
                  onClick={() => runAction(selected, "mark_maintenance", "set to maintenance")}
                  variant="ghost"
                />
              )}
              {selected.status === "maintenance" && (
                <ActionButton
                  icon={<CircleCheck size={15} />}
                  label="Mark available"
                  busy={busyAction === "mark_available"}
                  onClick={() => runAction(selected, "mark_available", "available")}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {scannerOpen && <ScannerModal onClose={() => setScannerOpen(false)} onSuccess={(msg) => { setToast(msg); refresh(); }} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white shadow-floating">
          {toast}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  busy,
  variant = "solid"
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  busy?: boolean;
  variant?: "solid" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={clsx(
        "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60",
        variant === "solid" ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-ink-200 text-ink-700 hover:bg-ink-50"
      )}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

function ScannerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(payload: string) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/pos/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrPayload: payload })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error?.message ?? "Ticket not recognized.");
      return;
    }
    onSuccess(`Checked in table ${data.table.tableCode} via QR`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-floating">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink-900">
            <QrCode size={18} /> Scan ticket
          </h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/60">
          <ScanLine size={40} className="animate-pulse-soft text-brand-500" />
        </div>
        <p className="mb-3 text-center text-xs text-ink-400">Camera simulation — paste or type the guest's ticket token below.</p>

        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="e.g. 9012-a1b2c3d4"
          className="mb-2 w-full rounded-lg border border-ink-100 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
        />
        {error && <p className="mb-2 text-xs font-semibold text-capacity-red">{error}</p>}
        <button
          onClick={() => submit(token)}
          disabled={!token || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <CircleCheck size={15} />}
          Confirm check-in
        </button>
      </div>
    </div>
  );
}
