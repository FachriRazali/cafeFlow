"use client";

import clsx from "clsx";
import { PriceTier } from "@/lib/types";

export type SortMode = "popularity" | "distance" | "availability";
export type AvailabilityFilter = "any" | "green" | "yellow" | "red";

interface Props {
  priceTiers: PriceTier[];
  activePriceTiers: PriceTier[];
  onTogglePriceTier: (tier: PriceTier) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  availability: AvailabilityFilter;
  onAvailabilityChange: (a: AvailabilityFilter) => void;
  hasLocation: boolean;
}

const AVAILABILITY_OPTIONS: { value: AvailabilityFilter; label: string; dot: string }[] = [
  { value: "any", label: "Any availability", dot: "bg-ink-400" },
  { value: "green", label: "Seats open", dot: "bg-capacity-green" },
  { value: "yellow", label: "Filling up", dot: "bg-capacity-yellow" },
  { value: "red", label: "Nearly full", dot: "bg-capacity-red" }
];

export function FilterBar({
  priceTiers,
  activePriceTiers,
  onTogglePriceTier,
  sort,
  onSortChange,
  availability,
  onAvailabilityChange,
  hasLocation
}: Props) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Price</span>
        {priceTiers.map((tier) => {
          const active = activePriceTiers.includes(tier);
          return (
            <button
              key={tier}
              onClick={() => onTogglePriceTier(tier)}
              className={clsx(
                "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                active ? "border-brand-600 bg-brand-600 text-white" : "border-ink-100 bg-surface text-ink-600 hover:border-brand-300"
              )}
            >
              {tier}
            </button>
          );
        })}

        <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Availability</span>
        <div className="flex items-center gap-1.5 rounded-full bg-surface p-1 ring-1 ring-ink-100">
          {AVAILABILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onAvailabilityChange(opt.value)}
              className={clsx(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition",
                availability === opt.value ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"
              )}
            >
              <span className={clsx("h-1.5 w-1.5 rounded-full", opt.dot)} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Sort</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          className="rounded-full border border-ink-100 bg-surface px-3 py-1.5 text-sm font-medium text-ink-800 focus:outline-none"
        >
          <option value="popularity">Popularity</option>
          <option value="distance" disabled={!hasLocation}>
            Nearest to me{!hasLocation ? " (enable location)" : ""}
          </option>
          <option value="availability">Most available</option>
        </select>
      </div>
    </div>
  );
}
