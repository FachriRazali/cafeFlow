import { useEffect, useState } from "react";

/** Returns remaining seconds until `deadlineIso`, ticking every second. */
export function useCountdown(deadlineIso: string | null | undefined) {
  const [remainingMs, setRemainingMs] = useState<number>(() => (deadlineIso ? new Date(deadlineIso).getTime() - Date.now() : 0));

  useEffect(() => {
    if (!deadlineIso) return;
    const tick = () => setRemainingMs(new Date(deadlineIso).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineIso]);

  const clamped = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { minutes, seconds, expired: clamped <= 0, totalSeconds };
}
