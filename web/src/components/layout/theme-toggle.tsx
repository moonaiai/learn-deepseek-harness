"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Reads/writes `localStorage.theme` and toggles the `.dark` class on
 * `<html>`. The initial class is set synchronously before paint by an inline
 * script in the root layout (see `app/[locale]/layout.tsx`) to avoid a
 * flash of the wrong theme; this component only handles the toggle click. */
export function ThemeToggle({ label }: { label: string }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="rounded-lg p-2 text-[--color-text-muted] transition-colors hover:bg-[--color-surface-hover] hover:text-[--color-text]"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
