"use client";

import React, { useState } from "react";
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
        <span className="text-[9px] text-emerald-400 font-medium">● Playoff (Top 2)</span>
        <span className="text-[9px] text-blue-400 font-medium">● Wild Card (3rd)</span>
        <span className="text-[9px] text-foreground/30 font-medium">● Safe</span>
        <span className="text-[9px] text-orange-400 font-medium">● Relegation Playoff ⚔ (2nd from bottom)</span>
        <span className="text-[9px] text-red-400 font-medium">● Auto-Relegate ↓ (Last)</span>
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
            // Per-pool zone logic:
            // Top 2 = Playoff, 3rd = Wild Card, 2nd from bottom = Relegation Playoff, Last = Auto-Relegate
            // Everything in between = Safe
            const isPlayoff = i < 2;
            const isWildCard = i === 2 && count > 3;
            const isAutoRelegate = i === count - 1 && count > 2;
            const isRelegationPlayoff = i === count - 2 && count > 3 && !isPlayoff && !isWildCard;
            const isSafe = !isPlayoff && !isWildCard && !isAutoRelegate && !isRelegationPlayoff;

            let rankColor = "text-muted-foreground/50";
            let leftBorder = "";
            let zoneIcon = "";

            if (isPlayoff) {
              rankColor = "text-emerald-400";
              leftBorder = "border-l-[3px] border-l-emerald-500/50";
            } else if (isWildCard) {
              rankColor = "text-blue-400";
              leftBorder = "border-l-[3px] border-l-blue-500/40";
            } else if (isAutoRelegate) {
              rankColor = "text-red-400";
              leftBorder = "border-l-[3px] border-l-red-500/50";
              zoneIcon = "↓";
            } else if (isRelegationPlayoff) {
              rankColor = "text-orange-400";
              leftBorder = "border-l-[3px] border-l-orange-500/40";
              zoneIcon = "⚔";
            } else if (isSafe) {
              leftBorder = "border-l-[3px] border-l-foreground/10";
            }

            // Zone group borders (inline styles for dynamic colors)
            function getZone(idx: number) {
              if (idx < 0 || idx >= count) return "none";
              if (idx < 2) return "playoff";
              if (idx === 2 && count > 3) return "wildcard";
              if (idx === count - 1 && count > 2) return "autorel";
              if (idx === count - 2 && count > 3 && idx >= 3) return "relplayoff";
              return "safe";
            }
            const myZone = getZone(i);
            const prevZone = getZone(i - 1);
            const nextZone = getZone(i + 1);

            const zoneRGB: Record<string, string> = {
              playoff: "16,185,129",
              wildcard: "59,130,246",
              relplayoff: "249,115,22",
              autorel: "239,68,68",
            };
            const rgb = zoneRGB[myZone] ?? "";
            const isZoneStart = myZone !== "safe" && myZone !== "none" && prevZone !== myZone;
            const isZoneEnd = myZone !== "safe" && myZone !== "none" && nextZone !== myZone;
            const isInZone = myZone !== "safe" && myZone !== "none";

            const zoneBorderStyle: React.CSSProperties = {
              ...(isZoneStart ? { borderTop: `2px solid rgba(${rgb},0.25)` } : {}),
              ...(isZoneEnd ? { borderBottom: `2px solid rgba(${rgb},0.25)` } : {}),
            };
            const zoneRightStyle: React.CSSProperties = isInZone
              ? { borderRight: `2px solid rgba(${rgb},0.25)` }
              : {};

            const needsSpacerBefore = isZoneStart && prevZone !== "none" && prevZone !== myZone && i > 0;

            const clinched = hasClinched(i);
            const eliminated = isEliminated(i);

            const streakColor = s.streak.startsWith("W")
              ? "text-emerald-400"
              : s.streak.startsWith("L")
                ? "text-red-400"
                : "text-muted-foreground/30";

            return (
              <React.Fragment key={s.id}>
                {needsSpacerBefore && (
                  <tr className="h-2">
                    <td colSpan={8} className="p-0" />
                  </tr>
                )}
                <tr className="text-sm" style={zoneBorderStyle}>
                  <td className={`px-3 py-2 tabular-nums text-xs font-bold ${rankColor} ${leftBorder}`}>
                    {i + 1}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      {s.linkHref ? (
                        <Link
                          href={s.linkHref}
                          className="hover:text-gold transition-colors"
                        >
                          {s.name}
                        </Link>
                      ) : (
                        <span>{s.name}</span>
                      )}
                      {zoneIcon && (
                        <span className={`text-[8px] font-bold ${rankColor}`}>{zoneIcon}</span>
                      )}
                      {clinched && (
                        <span className="text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1 rounded">✓</span>
                      )}
                      {eliminated && (
                        <span className="text-[8px] font-bold text-muted-foreground/40 bg-muted/10 px-1 rounded">✗</span>
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
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground hidden sm:table-cell" style={zoneRightStyle}>
                    {s.avgTime > 0 ? formatTime(s.avgTime) : "—"}
                  </td>
                </tr>
              </React.Fragment>
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
