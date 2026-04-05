"use client";

import { useEffect, useState } from "react";

const ACCENT_OPTIONS = [
  { name: "Gold", color: "212, 175, 55", dark: "184, 148, 30" },
  { name: "Red", color: "239, 68, 68", dark: "220, 50, 50" },
  { name: "Blue", color: "59, 130, 246", dark: "37, 110, 220" },
  { name: "Emerald", color: "16, 185, 129", dark: "12, 160, 110" },
  { name: "Purple", color: "168, 85, 247", dark: "145, 65, 220" },
] as const;

const STORAGE_KEY = "theme-accent";

function applyAccent(color: string, dark: string) {
  document.documentElement.style.setProperty("--accent-color", color);
  document.documentElement.style.setProperty("--accent-color-dark", dark);
}

export function ThemeAccentPicker() {
  const [active, setActive] = useState<string>(ACCENT_OPTIONS[0].color);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const option = ACCENT_OPTIONS.find((o) => o.color === saved);
      if (option) {
        setActive(option.color);
        applyAccent(option.color, option.dark);
      }
    }
  }, []);

  function handleSelect(option: (typeof ACCENT_OPTIONS)[number]) {
    setActive(option.color);
    applyAccent(option.color, option.dark);
    localStorage.setItem(STORAGE_KEY, option.color);
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5">
      <span className="text-[11px] text-muted-foreground mr-1">Accent</span>
      {ACCENT_OPTIONS.map((option) => (
        <button
          key={option.name}
          type="button"
          title={option.name}
          onClick={() => handleSelect(option)}
          className="relative h-4 w-4 rounded-full transition-transform hover:scale-125 focus:outline-none"
          style={{ backgroundColor: `rgb(${option.color})` }}
        >
          {active === option.color && (
            <span className="absolute inset-0 rounded-full ring-2 ring-foreground/60 ring-offset-1 ring-offset-popover" />
          )}
        </button>
      ))}
    </div>
  );
}
