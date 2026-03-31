"use client";

import { useState } from "react";
import type { Milestone } from "@/lib/milestones";

export function MilestonesBanner({ milestones }: { milestones: Milestone[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = milestones.filter((m) => !dismissed.has(m.id));
  if (visible.length === 0) return null;

  const colors = {
    gold: "from-gold/10 to-gold/5 border-gold/20 text-gold",
    fire: "from-orange-500/10 to-orange-500/5 border-orange-500/20 text-orange-400",
    info: "from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400",
  };

  return (
    <div className="space-y-2">
      {visible.map((m) => (
        <div
          key={m.id}
          className={`flex items-center gap-3 rounded-xl border bg-gradient-to-r px-4 py-2.5 ${colors[m.type]} animate-slide-down`}
        >
          <span className="text-base">{m.icon}</span>
          <span className="text-xs font-semibold flex-1">{m.text}</span>
          <button
            onClick={() => setDismissed(new Set([...dismissed, m.id]))}
            className="text-muted-foreground/30 hover:text-muted-foreground transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
