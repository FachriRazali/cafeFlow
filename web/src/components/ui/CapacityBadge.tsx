import clsx from "clsx";
import { CapacityColor } from "@/lib/types";

const STYLES: Record<CapacityColor, { dot: string; bg: string; text: string; label: string }> = {
  green: { dot: "bg-capacity-green", bg: "bg-capacity-greenBg", text: "text-capacity-green", label: "Seats open" },
  yellow: { dot: "bg-capacity-yellow", bg: "bg-capacity-yellowBg", text: "text-capacity-yellow", label: "Filling up" },
  red: { dot: "bg-capacity-red", bg: "bg-capacity-redBg", text: "text-capacity-red", label: "Nearly full" }
};

export function CapacityBadge({
  color,
  occupancyPct,
  size = "md"
}: {
  color: CapacityColor;
  occupancyPct: number;
  size?: "sm" | "md";
}) {
  const s = STYLES[color];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        s.bg,
        s.text,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full animate-pulse-soft", s.dot)} />
      {s.label} · {occupancyPct}%
    </span>
  );
}

export function capacityDotClass(color: CapacityColor) {
  return STYLES[color].dot;
}

export function capacityTextClass(color: CapacityColor) {
  return STYLES[color].text;
}

export function capacityBgClass(color: CapacityColor) {
  return STYLES[color].bg;
}
