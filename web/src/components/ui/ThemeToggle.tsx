"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@/components/ui/icons";

const STORAGE_KEY = "cafeflow-theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to beige (light) theme" : "Switch to light-brown (dark) theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-ink-700 transition hover:bg-ink-100/70"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/** Inline, pre-hydration script — read once in <head> so there's no flash of the wrong theme. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
