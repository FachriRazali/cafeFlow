"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePolling } from "@/lib/usePolling";
import { Cafe, CafeTable, Floor } from "@/lib/types";
import { FloorPlanViewer } from "@/components/floorplan/FloorPlanViewer";
import { MenuSection } from "@/components/menu/MenuSection";
import { ReservationModal } from "@/components/reservation/ReservationModal";
import { CapacityBadge } from "@/components/ui/CapacityBadge";
import { ArrowLeft, Clock, MapPin, Star, Wallet } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface CafeDetail extends Cafe {
  floors: Floor[];
}

export default function CafeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [cafe, setCafe] = useState<CafeDetail | null>(null);
  const [selectedTable, setSelectedTable] = useState<CafeTable | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/cafes/${params.id}`);
    if (res.ok) setCafe(await res.json());
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // Poll for live capacity + table status, but only while the tab is
  // actually visible — keeps idle tabs from hammering the server.
  usePolling(refresh, 20000);

  function handleSelectTable(table: CafeTable) {
    if (table.status !== "available") return;
    setSelectedTable(table);
    setShowModal(true);
  }

  if (!cafe) {
    return <div className="flex min-h-screen items-center justify-center text-ink-400">Loading cafe…</div>;
  }

  return (
    <main className="min-h-screen bg-ink-50 pb-16">
      <div className="relative h-56 w-full sm:h-72">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cafe.coverImageUrl} alt={cafe.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <button
          onClick={() => router.push("/")}
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-sm font-semibold text-ink-900 backdrop-blur"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
      </div>

      {/* relative z-10: the hero image div above is `position: relative`, which — per CSS
          stacking rules — paints above plain static-flow boxes regardless of DOM order.
          Without this, the hero image bled over the top of this card in the -mt-10 overlap. */}
      <div className="relative z-10 mx-auto -mt-10 max-w-4xl px-4 sm:px-6">
        <div className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-ink-900/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-ink-900">{cafe.name}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-ink-600">
                <MapPin size={14} /> {cafe.address}
              </p>
            </div>
            <CapacityBadge color={cafe.liveCapacity.color} occupancyPct={cafe.liveCapacity.occupancyPct} />
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink-600">
            <span className="flex items-center gap-1.5">
              <Star size={14} className="fill-amber-400 text-amber-400" /> {cafe.avgRating} ({cafe.totalReviews} reviews)
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> {cafe.openingTime}–{cafe.closingTime}
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet size={14} />
              {cafe.requiresDownPayment ? `DP ${new Intl.NumberFormat("id-ID").format(cafe.dpAmount)} IDR` : "No down payment"}
            </span>
            <span className="rounded-full bg-ink-100 px-2.5 py-0.5 font-semibold text-ink-800">{cafe.priceTier}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="Available" value={cafe.liveCapacity.tablesAvailable} color="text-capacity-green" />
            <Stat label="Reserved" value={cafe.liveCapacity.tablesReserved} color="text-capacity-yellow" />
            <Stat label="Occupied" value={cafe.liveCapacity.tablesOccupied} color="text-capacity-red" />
          </div>
        </div>

        <div className="mt-6">
          <h2 className="mb-3 text-lg font-bold text-ink-900">Live floor plan</h2>
          <FloorPlanViewer floors={cafe.floors} onSelectTable={handleSelectTable} selectedTableId={selectedTable?.id} />
        </div>

        <MenuSection cafeId={cafe.id} menuDocumentUrl={cafe.menuDocumentUrl} menuDocumentType={cafe.menuDocumentType} />
      </div>

      {showModal && selectedTable && (
        <ReservationModal
          cafe={cafe}
          table={selectedTable}
          onClose={() => {
            setShowModal(false);
            refresh();
          }}
        />
      )}
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-ink-50 py-3">
      <p className={`text-xl font-extrabold ${color}`}>{value}</p>
      <p className="text-xs text-ink-400">{label}</p>
    </div>
  );
}
