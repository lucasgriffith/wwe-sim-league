"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordMatchResult } from "@/app/actions";
import { toast } from "sonner";
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
  memberImages?: [string | null, string | null]; // for tag teams
  wins: number;
  losses: number;
  overallRating: number | null;
  streak: number;
}

interface TierInfo {
  id: string;
  tier_number: number;
  name: string;
  slug: string | null;
}

interface Props {
  matches: UpcomingMatch[];
  participantStats: Record<string, ParticipantStats>;
  tiers: TierInfo[];
  remainingCount: number;
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

export function UpNextCard({ matches, participantStats, tiers, remainingCount }: Props) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(() =>
    Math.floor(Math.random() * matches.length)
  );
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [isPending, startTransition] = useTransition();

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
        await recordMatchResult(match.id, {
          ...(isTag
            ? { winner_tag_team_id: winnerId }
            : { winner_wrestler_id: winnerId }),
          match_time_seconds: timeSeconds,
        });
        const winnerName = winnerId === aId ? a.name : b.name;
        toast.success(`${winnerName} wins!`);
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
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to record result");
      }
    });
  }

  return (
    <div className="rounded-2xl border-2 border-gold/20 bg-gradient-to-b from-gold/[0.04] via-card to-card overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold/60">
            Up Next
          </span>
          <Badge variant="outline" className="text-[8px] border-border/20 text-muted-foreground/50">
            T{tier?.tier_number} · {tier?.name ?? "?"}
            {match.pool ? ` · Pool ${match.pool}` : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={randomize}
            className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
            disabled={isPending}
          >
            🎲 Shuffle
          </Button>
          <span className="text-[9px] text-muted-foreground/30 tabular-nums">
            {remainingCount} left
          </span>
        </div>
      </div>

      {/* Main matchup */}
      <div className="px-4 pb-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Left participant */}
          <div className="flex items-center gap-3">
            <ParticipantPhoto stats={a} />
            <div className="min-w-0">
              <div className="font-bold text-sm leading-tight truncate">{a.name}</div>
              <div className="text-[10px] text-muted-foreground/50 tabular-nums">
                {a.wins}-{a.losses} · {(aWinPct * 100).toFixed(0)}%
              </div>
              {a.overallRating ? (
                <div className="text-[9px] text-muted-foreground/40">OVR {a.overallRating}</div>
              ) : null}
              <div className={`text-[9px] font-medium ${streakColor(a.streak)}`}>
                {streakLabel(a.streak)}
              </div>
            </div>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center px-2">
            <span className="text-lg font-black text-muted-foreground/10">VS</span>
          </div>

          {/* Right participant */}
          <div className="flex items-center gap-3 flex-row-reverse">
            <ParticipantPhoto stats={b} />
            <div className="min-w-0 text-right">
              <div className="font-bold text-sm leading-tight truncate">{b.name}</div>
              <div className="text-[10px] text-muted-foreground/50 tabular-nums">
                {b.wins}-{b.losses} · {(bWinPct * 100).toFixed(0)}%
              </div>
              {b.overallRating ? (
                <div className="text-[9px] text-muted-foreground/40">OVR {b.overallRating}</div>
              ) : null}
              <div className={`text-[9px] font-medium ${streakColor(b.streak)}`}>
                {streakLabel(b.streak)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline match entry */}
      <div className="border-t border-gold/10 bg-gold/[0.02] px-4 py-3">
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
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              className="w-12 h-8 text-center text-xs font-bold tabular-nums bg-background/50"
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
