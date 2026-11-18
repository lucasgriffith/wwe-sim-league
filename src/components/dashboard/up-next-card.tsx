"use client";

import { useState, useCallback, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordMatchResult } from "@/app/actions";
import { toast } from "sonner";
import { MatchCardExport } from "./match-card-export";
import { RankBadge } from "@/components/ui/rank-badge";
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
  slug?: string | null;
  image: string | null;
  memberImages?: [string | null, string | null]; // for tag teams
  wins: number;
  losses: number;
  overallRating: number | null;
  poolRank?: string | null; // e.g. "1st in Pool A"
  streak: number;
  elo?: number | null;
  eloRank?: number | null;
}

interface TierInfo {
  id: string;
  tier_number: number;
  name: string;
  fullName?: string;
  slug: string | null;
}

interface Props {
  matches: UpcomingMatch[];
  participantStats: Record<string, ParticipantStats>;
  tiers: TierInfo[];
  remainingCount: number;
  // Chosen server-side: a render-time Math.random() here picks different
  // matches on server and client, breaking hydration
  initialIndex: number;
}

function ParticipantPhoto({ stats, size = "lg" }: { stats: ParticipantStats; size?: "lg" | "sm" }) {
  const cls = size === "lg" ? "h-16 w-16 sm:h-20 sm:w-20" : "h-12 w-12";
  const textCls = size === "lg" ? "text-xl" : "text-sm";

  // Tag team: show overlapping dual photos
  if (stats.memberImages) {
    const [imgA, imgB] = stats.memberImages;
    const memberCls = size === "lg" ? "h-12 w-12 sm:h-14 sm:w-14" : "h-9 w-9";
    return (
      <div className="flex items-center -space-x-3">
        {imgA ? (
          <img src={imgA} alt="" className={`${memberCls} rounded-full object-cover border-2 border-background shrink-0 relative z-10`} />
        ) : (
          <div className={`${memberCls} rounded-full bg-muted/30 border-2 border-background flex items-center justify-center shrink-0 relative z-10`}>
            <span className="text-[10px] font-bold text-muted-foreground/40">?</span>
          </div>
        )}
        {imgB ? (
          <img src={imgB} alt="" className={`${memberCls} rounded-full object-cover border-2 border-background shrink-0`} />
        ) : (
          <div className={`${memberCls} rounded-full bg-muted/30 border-2 border-background flex items-center justify-center shrink-0`}>
            <span className="text-[10px] font-bold text-muted-foreground/40">?</span>
          </div>
        )}
      </div>
    );
  }

  // Singles: single photo
  if (stats.image) {
    return <img src={stats.image} alt={stats.name} className={`${cls} rounded-xl object-cover border-2 border-gold/20`} />;
  }
  return (
    <div className={`${cls} rounded-xl bg-muted/20 border-2 border-gold/10 flex items-center justify-center`}>
      <span className={`${textCls} font-bold text-muted-foreground/20`}>{stats.name.charAt(0)}</span>
    </div>
  );
}

export function UpNextCard({ matches, participantStats, tiers, remainingCount, initialIndex }: Props) {
  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [isPending, startTransition] = useTransition();
  const [celebration, setCelebration] = useState<{
    winnerName: string;
    winnerId: string;
    matchTime: number;
  } | null>(null);
  const celebrationTimer = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    };
  }, []);

  const validMatches = matches.filter((m) => {
    const aId = m.wrestler_a_id || m.tag_team_a_id;
    const bId = m.wrestler_b_id || m.tag_team_b_id;
    return aId && bId && aId !== bId;
  });

  const randomize = useCallback(() => {
    if (validMatches.length <= 1) return;
    let newIdx: number;
    do {
      newIdx = Math.floor(Math.random() * validMatches.length);
    } while (newIdx === currentIdx && validMatches.length > 1);
    setCurrentIdx(newIdx);
    setMinutes("");
    setSeconds("");
  }, [validMatches.length, currentIdx]);

  if (validMatches.length === 0) return null;

  const match = validMatches[currentIdx % validMatches.length];
  const isTag = !!match.tag_team_a_id;
  const aId = match.wrestler_a_id || match.tag_team_a_id || "";
  const bId = match.wrestler_b_id || match.tag_team_b_id || "";
  const a = participantStats[aId] ?? { name: "?", image: null, wins: 0, losses: 0, overallRating: null, streak: 0 };
  const b = participantStats[bId] ?? { name: "?", image: null, wins: 0, losses: 0, overallRating: null, streak: 0 };
  const tier = tiers.find((t) => t.id === match.tier_id);

  const aWinPct = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
  const bWinPct = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;

  function streakLabel(s: number): string {
    if (s > 0) return `${s}W`;
    if (s < 0) return `${Math.abs(s)}L`;
    return "—";
  }

  function streakColor(s: number): string {
    if (s >= 3) return "text-emerald-400";
    if (s > 0) return "text-emerald-400/60";
    if (s <= -3) return "text-red-400";
    if (s < 0) return "text-red-400/60";
    return "text-muted-foreground/40";
  }

  function handleSubmitResult(winnerId: string) {
    const timeSeconds = (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
    if (timeSeconds === 0) {
      toast.error("Enter match time first");
      return;
    }
    startTransition(async () => {
      try {
        const result = await recordMatchResult(match.id, {
          ...(isTag
            ? { winner_tag_team_id: winnerId }
            : { winner_wrestler_id: winnerId }),
          match_time_seconds: timeSeconds,
        });
        for (const ms of result?.milestones ?? []) {
          const fn = ms.type === "success" ? toast.success : ms.type === "warning" ? toast.warning : toast.info;
          fn(`${ms.emoji} ${ms.message}`, { duration: 5000 });
        }
        const winnerName = winnerId === aId ? a.name : b.name;

        // Show celebration for 3 seconds
        setCelebration({ winnerName, winnerId, matchTime: timeSeconds });

        // No router.refresh() needed: the server action revalidates "/" and
        // its response already carries the fresh page data. The old deferred
        // refresh here could even trigger a full page reload (version-skew
        // protection after a deploy), wiping the milestone toasts.
        celebrationTimer.current = setTimeout(() => {
          setCelebration(null);
          setMinutes("");
          setSeconds("");
          // Auto-shuffle to next match
          if (validMatches.length > 1) {
            let newIdx: number;
            do {
              newIdx = Math.floor(Math.random() * validMatches.length);
            } while (newIdx === currentIdx);
            setCurrentIdx(newIdx);
          }
        }, 3000);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to record result");
      }
    });
  }

  function formatMatchTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Celebration screen
  if (celebration) {
    const winnerStats = celebration.winnerId === aId ? a : b;
    return (
      <div className="rounded-2xl border-2 border-gold/40 bg-gradient-to-b from-gold/[0.08] via-card to-card overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

        {/* Confetti particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: [
                  `rgb(var(--accent-color))`,
                  `rgba(var(--accent-color),0.7)`,
                  "#10b981", "#ef4444", "#3b82f6", "#a855f7"
                ][i % 6],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${2 + Math.random() * 1.5}s`,
              }}
            />
          ))}
        </div>

        <div className="relative px-6 py-8 flex flex-col items-center gap-3 text-center">
          {/* Winner photo */}
          <div className="relative">
            <div className="absolute -inset-2 rounded-full bg-gold/20 animate-ping-slow" />
            <ParticipantPhoto stats={winnerStats} size="lg" />
          </div>

          {/* Winner text */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold/60">
              Winner
            </div>
            <div className="text-xl sm:text-2xl font-black text-gold animate-pulse-gold">
              {celebration.winnerName}
            </div>
          </div>

          {/* Match info */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-[10px] border-gold/20 text-gold/60">
              T{tier?.tier_number} · {tier?.name ?? "?"}
            </Badge>
            <span className="tabular-nums font-medium">{formatMatchTime(celebration.matchTime)}</span>
          </div>

          {/* Share button */}
          <MatchCardExport
            winnerName={celebration.winnerName}
            loserName={celebration.winnerId === aId ? b.name : a.name}
            matchTime={formatMatchTime(celebration.matchTime)}
            tierName={tier?.name ?? "?"}
            tierNumber={tier?.tier_number ?? 0}
            winnerImageUrl={winnerStats.image}
          />
        </div>

        {/* CSS animations */}
        <style jsx>{`
          @keyframes confetti-fall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(300px) rotate(720deg); opacity: 0; }
          }
          .animate-confetti {
            animation: confetti-fall 3s ease-out forwards;
          }
          .animate-ping-slow {
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
          @keyframes ping {
            75%, 100% { transform: scale(1.5); opacity: 0; }
          }
          .animate-pulse-gold {
            animation: pulse-gold 1s ease-in-out infinite alternate;
          }
          @keyframes pulse-gold {
            0% { text-shadow: 0 0 8px rgba(var(--accent-color),0.3); }
            100% { text-shadow: 0 0 20px rgba(var(--accent-color),0.6); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="cut-br relative overflow-hidden bg-card">
      <div aria-hidden="true" className="halftone absolute inset-0" />

      {/* Title plate */}
      <div className="relative flex">
        <Link
          href={`/tiers/${tier?.slug ?? tier?.id ?? ""}`}
          className="cut-plate block min-w-0 max-w-full bg-gold py-3 pl-4 pr-12 text-black"
        >
          <span className="block font-mono text-[10px] font-bold tracking-widest">
            UP NEXT · TIER {tier?.tier_number}
            {match.pool ? ` · POOL ${match.pool}` : ""}
          </span>
          <span className="font-display block text-xl font-black sm:truncate sm:text-3xl">
            {tier?.fullName ?? tier?.name ?? "?"}
          </span>
        </Link>
      </div>

      {/* Header row */}
      <div className="relative px-4 pt-2 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {remainingCount} matches left
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={randomize}
              className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
              disabled={isPending}
            >
              Shuffle
            </Button>

          </div>
        </div>
      </div>

      {/* Main matchup */}
      <div className="relative px-3 sm:px-4 pb-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-2">
          {/* Left participant */}
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            <ParticipantPhoto stats={a} />
            <div className="min-w-0 w-full sm:flex-1">
              <div className="font-display font-black text-xl sm:text-3xl [overflow-wrap:anywhere]">
                {isTag ? (
                  <Link href={`/tag-teams/${aId}`} className="hover:text-gold transition-colors"><RankBadge rank={a.eloRank} />{a.name}</Link>
                ) : (
                  <Link href={`/roster/${a.slug ?? aId}`} className="hover:text-gold transition-colors"><RankBadge rank={a.eloRank} />{a.name}</Link>
                )}
              </div>
              <div className="text-xs text-foreground/70 tabular-nums font-medium">
                {a.wins}W-{a.losses}L · {(aWinPct * 100).toFixed(0)}%
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                {a.poolRank && (
                  <span className="text-[10px] text-gold/60 font-semibold">{a.poolRank}</span>
                )}
                {a.elo ? (
                  <span className="text-[10px] text-gold/70 font-semibold tabular-nums">ELO {a.elo}</span>
                ) : null}
                {a.overallRating ? (
                  <span className="text-[10px] text-foreground/50 font-medium">OVR {a.overallRating}</span>
                ) : null}
                <span className={`text-[10px] font-semibold ${streakColor(a.streak)}`}>
                  {streakLabel(a.streak)}
                </span>
              </div>
            </div>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center px-1">
            <span className="font-display text-2xl font-black text-muted-foreground/50">VS</span>
          </div>

          {/* Right participant */}
          <div className="flex min-w-0 flex-col items-end gap-2 sm:flex-row-reverse sm:items-center sm:gap-3">
            <ParticipantPhoto stats={b} />
            <div className="min-w-0 w-full sm:flex-1 text-right">
              <div className="font-display font-black text-xl sm:text-3xl [overflow-wrap:anywhere]">
                {isTag ? (
                  <Link href={`/tag-teams/${bId}`} className="hover:text-gold transition-colors">{b.name}<RankBadge rank={b.eloRank} className="ml-1 mr-0" /></Link>
                ) : (
                  <Link href={`/roster/${b.slug ?? bId}`} className="hover:text-gold transition-colors">{b.name}<RankBadge rank={b.eloRank} className="ml-1 mr-0" /></Link>
                )}
              </div>
              <div className="text-xs text-foreground/70 tabular-nums font-medium">
                {b.wins}W-{b.losses}L · {(bWinPct * 100).toFixed(0)}%
              </div>
              <div className="flex items-center justify-end gap-2 mt-0.5">
                {b.poolRank && (
                  <span className="text-[10px] text-gold/60 font-semibold">{b.poolRank}</span>
                )}
                {b.elo ? (
                  <span className="text-[10px] text-gold/70 font-semibold tabular-nums">ELO {b.elo}</span>
                ) : null}
                {b.overallRating ? (
                  <span className="text-[10px] text-foreground/50 font-medium">OVR {b.overallRating}</span>
                ) : null}
                <span className={`text-[10px] font-semibold ${streakColor(b.streak)}`}>
                  {streakLabel(b.streak)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Elo win probability */}
      {a.elo && b.elo ? (() => {
        const pA = 1 / (1 + Math.pow(10, (b.elo - a.elo) / 400));
        const pctA = Math.round(pA * 100);
        return (
          <div className="relative px-3 sm:px-4 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
              <span className={pctA >= 50 ? "text-gold" : "text-muted-foreground/60"}>{pctA}%</span>
              <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted/20">
                <div className="h-full bg-gold/80" style={{ width: `${pctA}%` }} />
                <div className="h-full flex-1 bg-foreground/15" />
              </div>
              <span className={pctA < 50 ? "text-gold" : "text-muted-foreground/60"}>{100 - pctA}%</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground/40">
              <span>Win probability</span>
              <Link href={`/match/${match.id}`} className="font-semibold text-gold/70 hover:text-gold">
                Tale of the tape →
              </Link>
            </div>
          </div>
        );
      })() : null}

      {/* Inline match entry */}
      <div className="relative border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Time input */}
          <div className="flex items-center gap-1 shrink-0">
            <Input
              type="number"
              placeholder="M"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-12 h-8 text-center text-xs font-bold tabular-nums bg-background/50"
              disabled={isPending}
            />
            <span className="text-sm font-bold text-muted-foreground/30">:</span>
            <Input
              type="number"
              placeholder="S"
              value={seconds}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (isNaN(val) || e.target.value === "") {
                  setSeconds(e.target.value);
                } else if (val < 0) {
                  setSeconds("59");
                } else if (val > 59) {
                  setSeconds("0");
                } else {
                  setSeconds(e.target.value);
                }
              }}
              className="w-14 h-8 text-center text-xs font-bold tabular-nums bg-background/50"
              disabled={isPending}
            />
          </div>

          {/* Winner buttons */}
          <button
            className="flex-1 h-8 rounded-lg border border-border/30 bg-card/50 text-xs font-bold truncate px-2 hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98] transition-all disabled:opacity-50"
            onClick={() => handleSubmitResult(aId)}
            disabled={isPending}
          >
            {a.name}
          </button>
          <button
            className="flex-1 h-8 rounded-lg border border-border/30 bg-card/50 text-xs font-bold truncate px-2 hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98] transition-all disabled:opacity-50"
            onClick={() => handleSubmitResult(bId)}
            disabled={isPending}
          >
            {b.name}
          </button>
        </div>
        <div className="text-center mt-1.5">
          <span className="text-[8px] uppercase tracking-widest text-muted-foreground/30 font-semibold">
            enter time then tap winner
          </span>
        </div>
      </div>
    </div>
  );
}
