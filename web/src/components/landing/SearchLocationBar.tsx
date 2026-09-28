"use client";

import { useState } from "react";
import { District } from "@/lib/types";
import { getCurrentPosition } from "@/lib/haversine";
import { MapPin, Navigation, Search, Loader2, ChevronDown } from "@/components/ui/icons";

interface Props {
  districts: District[];
  onLocate: (coords: { lat: number; lng: number } | null) => void;
  onDistrictChange: (districtId: number | null) => void;
  onQueryChange: (q: string) => void;
  selectedDistrictId: number | null;
  locating: boolean;
  locatedLabel: string | null;
}

export function SearchLocationBar({
  districts,
  onLocate,
  onDistrictChange,
  onQueryChange,
  selectedDistrictId,
  locating,
  locatedLabel
}: Props) {
  const [query, setQuery] = useState("");

  async function handleGps() {
    try {
      const pos = await getCurrentPosition();
      onLocate(pos);
    } catch {
      onLocate(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-2xl bg-surface p-3 shadow-floating ring-1 ring-ink-900/5 sm:flex-row sm:items-center sm:gap-2 sm:p-2">
      <div className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 sm:border-r sm:border-ink-100">
        <Search size={18} className="shrink-0 text-ink-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onQueryChange(e.target.value);
          }}
          placeholder="Search cafes, e.g. Kopi Kina"
          className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 sm:border-r sm:border-ink-100">
        <MapPin size={18} className="shrink-0 text-ink-400" />
        <div className="relative w-full sm:w-48">
          <select
            value={selectedDistrictId ?? ""}
            onChange={(e) => onDistrictChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full appearance-none bg-transparent pr-6 text-sm text-ink-900 focus:outline-none"
          >
            <option value="">All districts (Kecamatan)</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.city}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-ink-400" />
        </div>
      </div>

      <button
        onClick={handleGps}
        disabled={locating}
        className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-70"
      >
        {locating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
        {locating ? "Locating…" : locatedLabel ? locatedLabel : "Use my location"}
      </button>
    </div>
  );
}
