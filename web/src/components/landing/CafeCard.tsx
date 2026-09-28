"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Cafe } from "@/lib/types";
import { formatDistance } from "@/lib/haversine";
import { CapacityBadge } from "@/components/ui/CapacityBadge";
import { MapPin, Star, Users } from "@/components/ui/icons";

export function CafeCard({ cafe, index }: { cafe: Cafe; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
    >
      <Link
        href={`/cafe/${cafe.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl bg-surface shadow-soft ring-1 ring-ink-900/5 transition hover:-translate-y-1 hover:shadow-card"
      >
        <div className="relative h-40 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cafe.coverImageUrl}
            alt={cafe.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute left-3 top-3">
            <CapacityBadge color={cafe.liveCapacity.color} occupancyPct={cafe.liveCapacity.occupancyPct} />
          </div>
          <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            {cafe.priceTier}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold leading-tight text-ink-900">{cafe.name}</h3>
            <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-800">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              {cafe.avgRating}
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-ink-400">
            <MapPin size={13} />
            {cafe.districtName}
            {cafe.distanceKm !== undefined && <span className="text-ink-600"> · {formatDistance(cafe.distanceKm)}</span>}
          </div>

          <div className="mt-auto flex items-center justify-between pt-2 text-xs text-ink-600">
            <span className="flex items-center gap-1">
              <Users size={13} />
              {cafe.liveCapacity.tablesAvailable} tables open of {cafe.liveCapacity.totalTables}
            </span>
            <span className="font-semibold text-brand-700 opacity-0 transition group-hover:opacity-100">View floor plan →</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
