"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
/* eslint-disable @next/next/no-img-element */

interface UpcomingMatch {
  id: string;
  tier_id: string;
  pool: string | null;
  wrestler_a_id: string | null;
  wrestler_b_id: string | null;
  tag_team_a_id: string | null;
  tag_team_b_id: string | null;
}

interface ParticipantStats {
  name: string;
  image: string | null;
  wins: number;
  losses: number;
  overallRating: number | null;
  streak: number; // positive = win streak, negative = loss streak
}

interface TierInfo {
  id: string;
  tier_number: number;
  name: string;
}

interface Props {
  matches: UpcomingMatch[];
  participantStats: Record<string, ParticipantStats>;
  tiers: TierInfo[];
  remainingCount: number;
}

function StatRow({
  label,
  valueA,
  valueB,
  format,
  higherIsBetter = true,
}: {
  label: string;
  valueA: number | string | null;
  valueB: number | string | null;
  format?: (v: number | string | null) => string;
  higherIsBetter?: boolean;
}) {
  const fmt = format ?? ((v) => (v != null ? String(v) : "—"));
  const numA = typeof valueA === "number" ? valueA : 0;
  const numB = typeof valueB === "number" ? valueB : 0;
  const aWins = higherIsBetter ? numA > numB : numA < numB;
  const bWins = higherIsBetter ? numB > numA : numB < numA;

  return (
    <div className="grid grid-cols-3 items-center text-xs py-1">
      <span className={`text-right tabular-nums font-semibold ${aWins ? "text-emerald-400" : bWins ? "text-muted-foreground/50" : ""}`}>
        {fmt(valueA)}
      </span>
      <span className="text-center text-[9px] text-muted-foreground/40 uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-left tabular-nums font-semibold ${bWins ? "text-emerald-400" : aWins ? "text-muted-foreground/50" : ""}`}>
        {fmt(valueB)}
      </span>
    </div>
  );
}

export function UpNextCard({ matches, participantStats, tiers, remainingCount }: Props) {
  const [currentIdx, setCurrentIdx] = useState(() =>
    Math.floor(Math.random() * matches.length)
  );

  // Filter out self-matches for shuffle count
  const validCount = matches.filter((m) => {
    const aId = m.wrestler_a_id || m.tag_team_a_id;
    const bId = m.wrestler_b_id || m.tag_team_b_id;
    return aId && bId && aId !== bId;
  }).length;

  const randomize = useCallback(() => {
    if (validCount <= 1) return;
    let newIdx: number;
    do {
      newIdx = Math.floor(Math.random() * validCount);
    } while (newIdx === currentIdx && validCount > 1);
    setCurrentIdx(newIdx);
  }, [validCount, currentIdx]);

  // Filter out self-matches (same participant on both sides)
  const validMatches = matches.filter((m) => {
    const aId = m.wrestler_a_id || m.tag_team_a_id;
    const bId = m.wrestler_b_id || m.tag_team_b_id;
    return aId && bId && aId !== bId;
  });

  if (validMatches.length === 0) return null;

  const match = validMatches[currentIdx % validMatches.length];
  const aId = match.wrestler_a_id || match.tag_team_a_id || "";
  const bId = match.wrestler_b_id || match.tag_team_b_id || "";
  const a = participantStats[aId] ?? { name: "?", image: null, wins: 0, losses: 0, overallRating: null, streak: 0 };
  const b = participantStats[bId] ?? { name: "?", image: null, wins: 0, losses: 0, overallRating: null, streak: 0 };
  const tier = tiers.find((t) => t.id === match.tier_id);

  const aWinPct = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
  const bWinPct = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;

  function streakLabel(s: number): string {
    if (s > 0) return `${s}W streak`;
    if (s < 0) return `${Math.abs(s)}L streak`;
    return "—";
  }

  function streakColor(s: number): string {
    if (s >= 3) return "text-emerald-400";
    if (s > 0) return "text-emerald-400/60";
    if (s <= -3) return "text-red-400";
    if (s < 0) return "text-red-400/60";
    return "text-muted-foreground/40";
  }

  return (
    <div className="rounded-2xl border-2 border-gold/20 bg-gradient-to-r from-gold/[0.03] via-card to-gold/[0.03] overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="relative px-4 sm:px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold/60">
              Up Next
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[9px] border-border/30 text-muted-foreground">
                T{tier?.tier_number} · {tier?.name ?? "?"}
              </Badge>
              {match.pool && (
                <Badge variant="outline" className="text-[9px] border-border/30 text-muted-foreground">
                  Pool {match.pool}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={randomize}
              className="text-xs gap-1 border-border/40 text-muted-foreground hover:text-foreground hover:border-gold/30"
            >
              🎲 Shuffle
            </Button>
            <Link href="/season/match">
              <Button size="sm" className="bg-gold text-black hover:bg-gold-dark font-semibold text-xs gap-1">
                🎮 Enter Result
              </Button>
            </Link>
          </div>
        </div>

        {/* Main comparison layout */}
        <div className="flex items-stretch gap-3 sm:gap-4">
          {/* Left wrestler photo */}
          <div className="flex flex-col items-center justify-start shrink-0">
            {a.image ? (
              <img src={a.image} alt={a.name} className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover border-2 border-gold/20 shadow-lg shadow-gold/5" />
            ) : (
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl bg-muted/20 border-2 border-gold/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-muted-foreground/20">{a.name.charAt(0)}</span>
              </div>
            )}
            <div className="mt-2 text-center max-w-[96px]">
              <div className="font-bold text-xs sm:text-sm leading-tight truncate">{a.name}</div>
              <div className={`text-[9px] mt-0.5 font-medium ${streakColor(a.streak)}`}>
                {streakLabel(a.streak)}
              </div>
            </div>
          </div>

          {/* Center stats comparison */}
          <div className="flex-1 min-w-0">
            <div className="rounded-lg border border-border/20 bg-card/50 px-3 py-2 divide-y divide-border/10">
              <StatRow
                label="Record"
                valueA={`${a.wins}-${a.losses}`}
                valueB={`${b.wins}-${b.losses}`}
                format={(v) => String(v)}
                higherIsBetter={true}
              />
              <StatRow
                label="Win%"
                valueA={aWinPct}
                valueB={bWinPct}
                format={(v) => typeof v === "number" ? `${(v * 100).toFixed(0)}%` : "—"}
              />
              <StatRow
                label="OVR"
                valueA={a.overallRating}
                valueB={b.overallRating}
                format={(v) => (v != null && Number(v) > 0) ? String(v) : "—"}
              />
            </div>

            {/* VS badge centered */}
            <div className="flex justify-center -mt-3 -mb-1 relative z-10">
              <span className="bg-card border border-gold/20 rounded-full px-3 py-0.5 text-[10px] font-black text-gold/50 uppercase tracking-widest">
                vs
              </span>
            </div>
          </div>

          {/* Right wrestler photo */}
          <div className="flex flex-col items-center justify-start shrink-0">
            {b.image ? (
              <img src={b.image} alt={b.name} className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover border-2 border-gold/20 shadow-lg shadow-gold/5" />
            ) : (
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl bg-muted/20 border-2 border-gold/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-muted-foreground/20">{b.name.charAt(0)}</span>
              </div>
            )}
            <div className="mt-2 text-center max-w-[96px]">
              <div className="font-bold text-xs sm:text-sm leading-tight truncate">{b.name}</div>
              <div className={`text-[9px] mt-0.5 font-medium ${streakColor(b.streak)}`}>
                {streakLabel(b.streak)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <span className="text-[9px] text-muted-foreground/40">
            {remainingCount} matches remaining
          </span>
        </div>
      </div>
    </div>
  );
}
