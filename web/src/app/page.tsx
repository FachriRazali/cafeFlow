"use client";

import { useEffect, useMemo, useState } from "react";
import { Cafe, District, PriceTier } from "@/lib/types";
import { SearchLocationBar } from "@/components/landing/SearchLocationBar";
import { FilterBar, AvailabilityFilter, SortMode } from "@/components/landing/FilterBar";
import { CafeCard } from "@/components/landing/CafeCard";
import { Coffee, Sparkles } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AuthStatus } from "@/components/ui/AuthStatus";
import { usePolling } from "@/lib/usePolling";

const PRICE_TIERS: PriceTier[] = ["$", "$$", "$$$"];

export default function LandingPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [sort, setSort] = useState<SortMode>("popularity");
  const [availability, setAvailability] = useState<AvailabilityFilter>("any");

  useEffect(() => {
    fetch("/api/districts")
      .then((r) => r.json())
      .then((d) => setDistricts(d.data));
  }, []);

  function fetchCafes(showSpinner: boolean) {
    const params = new URLSearchParams();
    if (coords) {
      params.set("lat", String(coords.lat));
      params.set("lng", String(coords.lng));
    }
    if (districtId) params.set("district_id", String(districtId));
    priceTiers.forEach((t) => params.append("price_tier", t));
    params.set("sort", sort);
    if (availability !== "any") params.set("availability", availability);
    if (query) params.set("q", query);

    if (showSpinner) setLoading(true);
    fetch(`/api/cafes?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setCafes(d.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchCafes(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, districtId, priceTiers, sort, availability, query]);

  // Refresh capacity in the background every 45s so cards stay roughly live —
  // infrequent on purpose, and paused entirely while the tab is hidden, to
  // keep request volume low once this is deployed for real.
  usePolling(() => fetchCafes(false), 45000);

  async function handleLocate(pos: { lat: number; lng: number } | null) {
    setLocating(true);
    setCoords(pos);
    setSort("distance");
    setLocating(false);
  }

  function togglePriceTier(tier: PriceTier) {
    setPriceTiers((prev) => (prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]));
  }

  const counts = useMemo(
    () => ({
      green: cafes.filter((c) => c.liveCapacity.color === "green").length,
      total: cafes.length
    }),
    [cafes]
  );

  return (
    <main className="min-h-screen bg-ink-50">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-surface/80 glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 font-extrabold text-ink-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Coffee size={18} />
            </span>
            CafeFlow
          </div>
          {/* No Merchant/POS shortcuts here on purpose — those are staff-only areas
              now gated by real login (middleware.ts), reached via "Staff login" below,
              not advertised on the customer-facing page. */}
          <nav className="flex items-center gap-2 text-sm font-semibold text-ink-600">
            <AuthStatus />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-950 via-brand-900 to-ink-50 pb-24 pt-14 text-white sm:pt-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white, transparent 35%)" }}
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/10 px-3 py-1 text-xs font-semibold text-brand-100">
            <Sparkles size={13} /> Real seats, in real time
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
            Find a cafe with a seat waiting for you.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-brand-100/80 sm:text-base">
            Live capacity, interactive floor plans, and instant reservations — no more guessing if there's room.
          </p>

          <div className="mt-8">
            <SearchLocationBar
              districts={districts}
              onLocate={handleLocate}
              onDistrictChange={setDistrictId}
              onQueryChange={setQuery}
              selectedDistrictId={districtId}
              locating={locating}
              locatedLabel={coords ? "Location set" : null}
            />
          </div>
        </div>
      </section>

      {/* Results */}
      {/* relative z-10: the hero section above is `position: relative`, which paints above
          plain static-flow boxes regardless of DOM order — without this, the hero bled over
          the top of the filter bar / cards in the -mt-12 overlap. */}
      <section className="relative z-10 mx-auto -mt-12 max-w-6xl px-4 pb-24 sm:px-6">
        <div className="mb-6 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-ink-900/5">
          <FilterBar
            priceTiers={PRICE_TIERS}
            activePriceTiers={priceTiers}
            onTogglePriceTier={togglePriceTier}
            sort={sort}
            onSortChange={setSort}
            availability={availability}
            onAvailabilityChange={setAvailability}
            hasLocation={!!coords}
          />
        </div>

        <div className="mb-4 flex items-center justify-between text-sm text-ink-600">
          <span>
            <strong className="text-ink-900">{counts.total}</strong> cafes found
            {counts.total > 0 && (
              <>
                {" "}
                · <span className="text-capacity-green font-semibold">{counts.green} with open seats</span>
              </>
            )}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-surface/70 ring-1 ring-ink-900/5" />
            ))}
          </div>
        ) : cafes.length === 0 ? (
          <div className="rounded-2xl bg-surface p-12 text-center text-ink-400 ring-1 ring-ink-900/5">
            No cafes match your filters yet. Try widening your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cafes.map((cafe, i) => (
              <CafeCard key={cafe.id} cafe={cafe} index={i} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
