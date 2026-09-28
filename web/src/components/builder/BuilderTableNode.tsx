"use client";

import clsx from "clsx";
import { CafeTable } from "@/lib/types";
import { STATUS_FILL } from "@/components/floorplan/TableShape";

interface Props {
  table: CafeTable;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, table: CafeTable) => void;
  onClick: (table: CafeTable) => void;
}

export function BuilderTableNode({ table, selected, onPointerDown, onClick }: Props) {
  const isRound = table.shape === "round";
  const isRect = table.shape === "rectangle";
  const fill = STATUS_FILL.available;

  return (
    <div
      onPointerDown={(e) => onPointerDown(e, table)}
      onClick={() => onClick(table)}
      style={{
        position: "absolute",
        left: table.x,
        top: table.y,
        width: table.width,
        height: table.height,
        transform: `rotate(${table.rotation}deg)`,
        backgroundColor: `${fill}22`,
        borderColor: fill,
        borderRadius: isRound ? "999px" : isRect ? 10 : 14
      }}
      className={clsx(
        "flex cursor-grab select-none flex-col items-center justify-center border-2 text-center transition-shadow active:cursor-grabbing",
        selected && "ring-2 ring-ink-900 ring-offset-2"
      )}
    >
      <span className="text-xs font-bold text-ink-900">{table.tableCode}</span>
      <span className="text-[10px] text-ink-600">{table.capacity} seats</span>
    </div>
  );
}
