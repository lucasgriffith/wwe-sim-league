"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { recordMatchResult } from "@/app/actions";
import { toast } from "sonner";

interface ScheduleMatch {
  id: string;
  aId: string;
  bId: string;
  aName: string;
  bName: string;
  winnerId: string | null;
  isPlayed: boolean;
  matchTime: number | null;
  isTag: boolean;
}

interface ScheduleRound {
  round: number;
  matches: ScheduleMatch[];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TierSchedule({
  rounds,
  isAdmin,
}: {
  rounds: ScheduleRound[];
  isAdmin: boolean;
}) {
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRecord(match: ScheduleMatch, winnerId: string) {
    const timeSeconds =
      (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
    if (timeSeconds === 0) {
      toast.error("Enter match time first");
      return;
    }

    startTransition(async () => {
      try {
        await recordMatchResult(match.id, {
          ...(match.isTag
            ? { winner_tag_team_id: winnerId }
            : { winner_wrestler_id: winnerId }),
          match_time_seconds: timeSeconds,
        });
        const winnerName = winnerId === match.aId ? match.aName : match.bName;
        toast.success(`${winnerName} wins!`);
        setExpandedMatch(null);
        setMinutes("");
        setSeconds("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden max-h-[500px] overflow-y-auto">
      <div className="p-3 border-b border-border/30 bg-muted/5 sticky top-0 z-10 backdrop-blur-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Schedule
          {isAdmin && (
            <span className="text-[9px] text-muted-foreground/40 font-normal ml-2">
              click unplayed to enter result
            </span>
          )}
        </h3>
      </div>
      <div className="divide-y divide-border/20">
        {rounds.map(({ round, matches }) => (
          <div key={round} className="px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5">
              Round {round}
            </div>
            <div className="space-y-1">
              {matches.map((m) => {
                const isExpanded = expandedMatch === m.id;
                return (
                  <div key={m.id}>
                    <div
                      className={`flex items-center gap-2 rounded px-2 py-1 text-xs transition-all ${
                        m.isPlayed
                          ? "bg-emerald-500/5"
                          : isExpanded
                            ? "bg-gold/5 border border-gold/20 cursor-pointer"
                            : isAdmin
                              ? "bg-muted/5 hover:bg-gold/5 cursor-pointer"
                              : "bg-muted/5"
                      }`}
                      onClick={() => {
                        if (m.isPlayed || !isAdmin) return;
                        setExpandedMatch(isExpanded ? null : m.id);
                        setMinutes("");
                        setSeconds("");
                      }}
                    >
                      <span
                        className={`flex-1 truncate text-right ${
                          m.isPlayed && m.winnerId === m.aId
                            ? "font-bold text-emerald-400"
                            : m.isPlayed
                              ? "text-muted-foreground/50"
                              : ""
                        }`}
                      >
                        {m.aName}
                      </span>
                      <span className="text-[9px] text-muted-foreground/30 shrink-0">
                        {m.isPlayed ? "✓" : "vs"}
                      </span>
                      <span
                        className={`flex-1 truncate ${
                          m.isPlayed && m.winnerId === m.bId
                            ? "font-bold text-emerald-400"
                            : m.isPlayed
                              ? "text-muted-foreground/50"
                              : ""
                        }`}
                      >
                        {m.bName}
                      </span>
                      {m.isPlayed && m.matchTime && (
                        <span className="text-[9px] tabular-nums text-muted-foreground/40 shrink-0">
                          {formatTime(m.matchTime)}
                        </span>
                      )}
                    </div>

                    {/* Inline entry */}
                    {isExpanded && isAdmin && !m.isPlayed && (
                      <div className="mt-1 mb-2 rounded-lg border border-gold/20 bg-gold/[0.02] p-2.5 space-y-2 animate-slide-down">
                        <div className="flex items-center justify-center gap-1.5">
                          <Input
                            type="number"
                            placeholder="Min"
                            min={0}
                            value={minutes}
                            onChange={(e) => setMinutes(e.target.value)}
                            className="w-14 h-8 text-center text-xs font-bold tabular-nums"
                            autoFocus
                          />
                          <span className="text-sm font-bold text-muted-foreground/30">:</span>
                          <Input
                            type="number"
                            placeholder="Sec"
                            min={0}
                            max={59}
                            value={seconds}
                            onChange={(e) => setSeconds(e.target.value)}
                            className="w-14 h-8 text-center text-xs font-bold tabular-nums"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 text-[11px] font-bold hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRecord(m, m.aId);
                            }}
                            disabled={isPending}
                          >
                            {m.aName}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 text-[11px] font-bold hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRecord(m, m.bId);
                            }}
                            disabled={isPending}
                          >
                            {m.bName}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
