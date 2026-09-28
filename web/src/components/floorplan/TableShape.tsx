import clsx from "clsx";
import { CafeTable, TableStatus } from "@/lib/types";

export const STATUS_FILL: Record<TableStatus, string> = {
  available: "#22c081",
  reserved: "#f2a71b",
  occupied: "#ef4d5e",
  maintenance: "#9aa2b1"
};

export const STATUS_LABEL: Record<TableStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  maintenance: "Maintenance"
};

interface Props {
  table: CafeTable;
  selected?: boolean;
  interactive?: boolean;
  onClick?: (table: CafeTable) => void;
  scale?: number;
}

export function TableShape({ table, selected, interactive = true, onClick, scale = 1 }: Props) {
  const fill = STATUS_FILL[table.status];
  const isRound = table.shape === "round";
  const isRect = table.shape === "rectangle";

  return (
    <g
      transform={`translate(${table.x * scale}, ${table.y * scale}) rotate(${table.rotation}, ${(table.width * scale) / 2}, ${
        (table.height * scale) / 2
      })`}
      onClick={() => interactive && onClick?.(table)}
      className={clsx(interactive && "cursor-pointer")}
    >
      {isRound ? (
        <circle
          cx={(table.width * scale) / 2}
          cy={(table.height * scale) / 2}
          r={(Math.min(table.width, table.height) * scale) / 2}
          fill={fill}
          fillOpacity={0.18}
          stroke={fill}
          strokeWidth={selected ? 3 : 2}
          className="transition-all duration-200"
        />
      ) : (
        <rect
          width={table.width * scale}
          height={table.height * scale}
          rx={isRect ? 8 : 12}
          fill={fill}
          fillOpacity={0.18}
          stroke={fill}
          strokeWidth={selected ? 3 : 2}
          className="transition-all duration-200"
        />
      )}
      <text
        x={(table.width * scale) / 2}
        y={(table.height * scale) / 2 - 4}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill="#14171f"
      >
        {table.tableCode}
      </text>
      <text x={(table.width * scale) / 2} y={(table.height * scale) / 2 + 12} textAnchor="middle" fontSize={10} fill="#565f72">
        {table.capacity} seats
      </text>
      {selected && (
        <rect
          width={table.width * scale}
          height={table.height * scale}
          rx={isRect ? 8 : 12}
          fill="none"
          stroke="#14171f"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
      )}
    </g>
  );
}
