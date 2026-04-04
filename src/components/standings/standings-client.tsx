"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { Standing, TierStandings } from "@/app/(public)/standings/page";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const divColors: Record<string, { pill: string; active: string }> = {
  "Men's Singles": { pill: "border-blue-500/30 text-blue-400 hover:bg-blue-500/10", active: "bg-blue-500/15 border-blue-500/40 text-blue-400" },
  "Women's Singles": { pill: "border-purple-500/30 text-purple-400 hover:bg-purple-500/10", active: "bg-purple-500/15 border-purple-500/40 text-purple-400" },
  "Men's Tag Teams": { pill: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10", active: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" },
  "Women's Tag Teams": { pill: "border-orange-500/30 text-orange-400 hover:bg-orange-500/10", active: "bg-orange-500/15 border-orange-500/40 text-orange-400" },
};

interface Props {
  divisions: Array<{
    name: string;
    tiers: TierStandings[];
  }>;
}

export function StandingsClient({ divisions }: Props) {
  const [activeDivision, setActiveDivision] = useState(divisions[0]?.name ?? "");

  const activeTiers = divisions.find((d) => d.name === activeDivision)?.tiers ?? [];

  return (
    <div>
      {/* Division jump pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {divisions.map((div) => {
          const isActive = activeDivision === div.name;
          const c = divColors[div.name] ?? divColors["Men's Singles"];
          return (
            <button
              key={div.name}
              onClick={() => setActiveDivision(div.name)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive ? c.active : `${c.pill} bg-transparent`
              }`}
            >
              {div.name}
              <span className="ml-1.5 text-[10px] opacity-60">{div.tiers.length}</span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border/30 bg-card/30 px-3 py-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40">Legend</span>
        <LegendItem color="emerald" label="Playoff (Top 2)" />
        <LegendItem color="blue" label="Wild Card (3rd)" />
        <LegendItem color="orange" label="Relegation ⚔" />
        <LegendItem color="red" label="Auto-Relegate ↓" />
      </div>

      {/* Tier standings */}
      <div className="space-y-6">
        {activeTiers.map((tier) => (
          <div key={tier.tierId} className="rounded-lg border border-border/40 overflow-hidden">
            <div className="bg-card/50 px-4 py-2.5 border-b border-border/30 flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                T{tier.tierNumber}
              </span>
              <Link
                href={`/tiers/${tier.tierSlug ?? tier.tierId}`}
                className="text-sm font-semibold hover:text-gold transition-colors"
              >
                {tier.tierShortName || tier.tierName}
              </Link>
            </div>

            {tier.hasPools ? (
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/30">
                {tier.pools.map((p) => (
                  <StandingsTable
                    key={p.pool ?? "all"}
                    label={p.pool ? `Pool ${p.pool}` : undefined}
                    standings={p.standings}
                    poolSize={p.standings.length}
                  />
                ))}
              </div>
            ) : (
              <StandingsTable
                standings={tier.pools[0]?.standings ?? []}
                poolSize={tier.pools[0]?.standings.length ?? 0}
              />
            )}
          </div>
        ))}

        {activeTiers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No tiers with assignments in this division.
          </p>
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/20 border-emerald-500/50",
    blue: "bg-blue-500/15 border-blue-500/40",
    orange: "bg-orange-500/15 border-orange-500/40",
    red: "bg-red-500/20 border-red-500/50",
  };
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-sm border-2 ${colors[color]}`} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function StandingsTable({
  standings,
  label,
  poolSize,
}: {
  standings: Standing[];
  label?: string;
  poolSize: number;
}) {
  const count = standings.length;
  const relegationPlayoffStart = Math.max(0, count - 4);
  const autoRelegateStart = Math.max(0, count - 2);
  const totalRounds = count > 1 ? count - 1 : 0;

  function hasClinched(idx: number): boolean {
    if (idx >= 2) return false;
    if (count < 3) return standings[idx].wins > 0;
    const myWins = standings[idx].wins;
    let maxRivalBest = 0;
    for (let j = 2; j < count; j++) {
      const rivalPlayed = standings[j].wins + standings[j].losses;
      const rivalRemaining = totalRounds - rivalPlayed;
      const rivalBest = standings[j].wins + rivalRemaining;
      maxRivalBest = Math.max(maxRivalBest, rivalBest);
    }
    return myWins > maxRivalBest;
  }

  function isEliminated(idx: number): boolean {
    if (idx < 2) return false;
    const gamesPlayed = standings[idx].wins + standings[idx].losses;
    const remaining = totalRounds - gamesPlayed;
    const myBestCase = standings[idx].wins + remaining;
    if (count >= 2 && myBestCase < standings[1].wins) return true;
    return false;
  }

  return (
    <div>
      {label && (
        <div className="px-4 py-1.5 bg-muted/10">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 border-b border-border/20">
            <th className="px-3 py-2 text-left w-8">#</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-center w-8">W</th>
            <th className="px-3 py-2 text-center w-8">L</th>
            <th className="px-3 py-2 text-right w-12">Win%</th>
            <th className="px-3 py-2 text-center w-10">GB</th>
            <th className="px-3 py-2 text-center w-10">Strk</th>
            <th className="px-3 py-2 text-right w-14 hidden sm:table-cell">Avg Time</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            let rowBg = "";
            let zoneIndicator = "";
            if (i < 2) {
              rowBg = "bg-emerald-500/[0.08] border-l-[3px] border-l-emerald-500/50";
              zoneIndicator = "playoff";
            } else if (i === 2) {
              rowBg = "bg-blue-500/[0.06] border-l-[3px] border-l-blue-500/40";
              zoneIndicator = "wildcard";
            } else if (i >= autoRelegateStart && count > 4) {
              rowBg = "bg-red-500/[0.08] border-l-[3px] border-l-red-500/50";
              zoneIndicator = "auto-relegate";
            } else if (i >= relegationPlayoffStart && count > 4) {
              rowBg = "bg-orange-500/[0.06] border-l-[3px] border-l-orange-500/40";
              zoneIndicator = "relegation-playoff";
            }

            const clinched = hasClinched(i);
            const eliminated = isEliminated(i);

            const streakColor = s.streak.startsWith("W")
              ? "text-emerald-400"
              : s.streak.startsWith("L")
                ? "text-red-400"
                : "text-muted-foreground/30";

            return (
              <tr
                key={s.id}
                className={`border-b border-border/10 text-sm ${rowBg}`}
              >
                <td className="px-3 py-2 tabular-nums text-xs text-muted-foreground">
                  {i + 1}
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    {s.linkHref ? (
                      <Link
                        href={s.linkHref}
                        className={`font-medium hover:text-gold transition-colors ${eliminated ? "text-muted-foreground/50" : ""}`}
                      >
                        {s.name}
                      </Link>
                    ) : (
                      <span className={`font-medium ${eliminated ? "text-muted-foreground/50" : ""}`}>{s.name}</span>
                    )}
                    {clinched && (
                      <Badge variant="outline" className="text-[8px] border-emerald-500/30 text-emerald-400 px-1 py-0">✓</Badge>
                    )}
                    {eliminated && (
                      <Badge variant="outline" className="text-[8px] border-muted-foreground/20 text-muted-foreground/40 px-1 py-0">✗</Badge>
                    )}
                    {zoneIndicator === "auto-relegate" && (
                      <span className="text-[8px] font-bold text-red-400/60">↓</span>
                    )}
                    {zoneIndicator === "relegation-playoff" && (
                      <span className="text-[8px] font-bold text-orange-400/60">⚔</span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 text-center tabular-nums font-medium text-emerald-400">
                  {s.wins}
                </td>
                <td className="px-3 py-2 text-center tabular-nums font-medium text-red-400">
                  {s.losses}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {s.wins + s.losses > 0
                    ? `${(s.winPct * 100).toFixed(0)}%`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-center tabular-nums text-xs text-muted-foreground">
                  {s.gb}
                </td>
                <td className={`px-3 py-2 text-center tabular-nums text-xs font-semibold ${streakColor}`}>
                  {s.streak}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground hidden sm:table-cell">
                  {s.avgTime > 0 ? formatTime(s.avgTime) : "—"}
                </td>
              </tr>
            );
          })}
          {standings.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matches played yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
