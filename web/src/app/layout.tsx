import type { Metadata } from "next";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/components/ui/ThemeToggle";

export const metadata: Metadata = {
  title: "CafeFlow — Live Capacity & Seat Reservation",
  description: "Find a cafe with real seats available, right now."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        {/* Runs before hydration so the correct theme applies with no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
