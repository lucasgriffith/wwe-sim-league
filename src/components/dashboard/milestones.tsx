"use client";

import { useState } from "react";

interface Milestone {
  id: string;
  icon: string;
  text: string;
  type: "gold" | "fire" | "info";
}

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

export function computeMilestones(stats: {
  totalPlayed: number;
  totalMatches: number;
  longestStreak: { name: string; streak: number } | null;
  fastestMatch: { name: string; time: number } | null;
  undefeated: string[];
  tiersCompleted: number;
}): Milestone[] {
  const milestones: Milestone[] = [];

  // Match count milestones
  const matchMilestones = [1, 10, 25, 50, 100, 200, 500];
  for (const n of matchMilestones) {
    if (stats.totalPlayed >= n && stats.totalPlayed < n + 5) {
      milestones.push({
        id: `matches-${n}`,
        icon: n === 1 ? "🎉" : "🏟️",
        text: n === 1
          ? "First match of Season 1 is in the books!"
          : `${n} matches played! The league is heating up.`,
        type: n === 1 ? "gold" : "info",
      });
    }
  }

  // Undefeated wrestlers
  if (stats.undefeated.length > 0 && stats.totalPlayed >= 3) {
    milestones.push({
      id: "undefeated",
      icon: "💎",
      text: `${stats.undefeated.slice(0, 3).join(", ")}${stats.undefeated.length > 3 ? ` +${stats.undefeated.length - 3} more` : ""} still undefeated!`,
      type: "gold",
    });
  }

  // Win streak
  if (stats.longestStreak && stats.longestStreak.streak >= 4) {
    milestones.push({
      id: "streak",
      icon: "🔥",
      text: `${stats.longestStreak.name} is on a ${stats.longestStreak.streak}-match win streak!`,
      type: "fire",
    });
  }

  // Fastest match
  if (stats.fastestMatch && stats.fastestMatch.time < 180) {
    const m = Math.floor(stats.fastestMatch.time / 60);
    const s = stats.fastestMatch.time % 60;
    milestones.push({
      id: "fastest",
      icon: "⚡",
      text: `Fastest match: ${m}:${s.toString().padStart(2, "0")} — ${stats.fastestMatch.name}!`,
      type: "fire",
    });
  }

  // Tier completion
  if (stats.tiersCompleted > 0) {
    milestones.push({
      id: `tiers-${stats.tiersCompleted}`,
      icon: "✅",
      text: `${stats.tiersCompleted} tier${stats.tiersCompleted > 1 ? "s" : ""} completed pool play!`,
      type: "info",
    });
  }

  return milestones.slice(0, 3); // Max 3 at once
}
