"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `callback` on an interval, but pauses entirely while the browser tab
 * is hidden — this is the main lever for keeping server request volume low
 * once the app has real traffic (a laptop with 20 idle background tabs
 * should cost the server ~0 requests/min, not 20 * interval).
 *
 * Fires once immediately when the tab becomes visible again so the view
 * doesn't sit stale after someone tabs back in.
 */
export function usePolling(callback: () => void, intervalMs: number) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (id !== null) return;
      id = setInterval(() => savedCallback.current(), intervalMs);
    }
    function stop() {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    }
    function handleVisibility() {
      if (document.hidden) {
        stop();
      } else {
        savedCallback.current();
        start();
      }
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}
