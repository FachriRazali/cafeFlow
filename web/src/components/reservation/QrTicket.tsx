"use client";

import { useEffect, useRef } from "react";

/** Renders a scannable QR code client-side from any payload string. */
export function QrTicket({ payload, size = 176 }: { payload: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("qrcode").then((QRCode) => {
      if (cancelled || !canvasRef.current) return;
      QRCode.toCanvas(canvasRef.current, payload, {
        width: size,
        margin: 1,
        color: { dark: "#14171f", light: "#ffffff" }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [payload, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="rounded-xl ring-1 ring-ink-100" />;
}
