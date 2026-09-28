"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { CafeTable, Floor } from "@/lib/types";
import { TableShape, STATUS_LABEL } from "./TableShape";
import { Building2, DoorOpen, Flame, TreePine } from "@/components/ui/icons";

const ZONE_ICON = { indoor: DoorOpen, outdoor: TreePine, smoking: Flame } as const;

interface Props {
  floors: Floor[];
  onSelectTable: (table: CafeTable) => void;
  selectedTableId?: number | null;
}

export function FloorPlanViewer({ floors, onSelectTable, selectedTableId }: Props) {
  const [activeFloorId, setActiveFloorId] = useState(floors[0]?.id);
  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? floors[0];
  const levels = useMemo(() => [...new Set(floors.map((f) => f.level))].sort((a, b) => a - b), [floors]);
  const floorsOnLevel = useMemo(
    () => floors.filter((f) => f.level === (activeFloor?.level ?? levels[0])),
    [floors, activeFloor, levels]
  );

  if (!activeFloor) {
    return <div className="rounded-2xl bg-surface p-12 text-center text-ink-400 ring-1 ring-ink-900/5">No floor plan published yet.</div>;
  }

  function selectLevel(level: number) {
    const firstOnLevel = floors.find((f) => f.level === level);
    if (firstOnLevel) setActiveFloorId(firstOnLevel.id);
  }

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-ink-900/5 sm:p-6">
      {levels.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {levels.map((level) => (
            <button
              key={level}
              onClick={() => selectLevel(level)}
              className={clsx(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition",
                activeFloor.level === level ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              )}
            >
              <Building2 size={14} /> Lantai {level}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {floorsOnLevel.map((f) => {
            const Icon = ZONE_ICON[f.zoneType];
            return (
              <button
                key={f.id}
                onClick={() => setActiveFloorId(f.id)}
                className={clsx(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition",
                  activeFloorId === f.id ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100"
                )}
              >
                <Icon size={14} /> {f.name}
              </button>
            );
          })}
        </div>
        <Legend />
      </div>

      <div className="overflow-auto rounded-xl border border-dashed border-ink-100 bg-ink-50/60 p-2">
        <svg
          viewBox={`0 0 ${activeFloor.canvasWidth} ${activeFloor.canvasHeight}`}
          width="100%"
          className="max-h-[520px] w-full"
          style={{ minWidth: 480 }}
        >
          <rect width={activeFloor.canvasWidth} height={activeFloor.canvasHeight} fill="transparent" />
          {activeFloor.tables.map((t) => (
            <TableShape key={t.id} table={t} selected={t.id === selectedTableId} onClick={onSelectTable} />
          ))}
        </svg>
      </div>
      <p className="mt-3 text-center text-xs text-ink-400">Tap a green table to start a reservation.</p>
    </div>
  );
}

function Legend() {
  const items: { color: string; label: string }[] = [
    { color: "#22c081", label: STATUS_LABEL.available },
    { color: "#f2a71b", label: STATUS_LABEL.reserved },
    { color: "#ef4d5e", label: STATUS_LABEL.occupied }
  ];
  return (
    <div className="flex items-center gap-3 text-xs text-ink-600">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
