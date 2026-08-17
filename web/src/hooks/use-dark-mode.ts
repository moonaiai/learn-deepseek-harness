"use client";

import { useEffect, useState } from "react";

/** Tracks the `.dark` class on `<html>` (toggled by {@link ThemeToggle}) via a
 * MutationObserver, so client islands like the Mermaid renderer can react to
 * theme changes without prop drilling. */
export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
