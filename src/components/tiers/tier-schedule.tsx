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
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") return window.innerWidth >= 1024;
    return false;
  });
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const totalMatches = rounds.reduce((sum, r) => sum + r.matches.length, 0);
  const playedCount = rounds.reduce((sum, r) => sum + r.matches.filter((m) => m.isPlayed).length, 0);

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

  // Split rounds into two columns
  const midpoint = Math.ceil(rounds.length / 2);
  const leftRounds = rounds.slice(0, midpoint);
  const rightRounds = rounds.slice(midpoint);

  function renderRound({ round, matches }: ScheduleRound) {
    return (
      <div key={round} className="px-2.5 py-1.5">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1">
          R{round}
        </div>
        <div className="space-y-0.5">
          {matches.map((m) => {
            const isExpanded = expandedMatch === m.id;
            return (
              <div key={m.id}>
                <div
                  className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] transition-all ${
                    m.isPlayed
                      ? "bg-gold/5"
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
                        ? "font-bold text-gold"
                        : m.isPlayed
                          ? "text-muted-foreground/50"
                          : ""
                    }`}
                  >
                    {m.aName}
                  </span>
                  <span className="text-[8px] text-muted-foreground/30 shrink-0">
                    {m.isPlayed ? "✓" : "vs"}
                  </span>
                  <span
                    className={`flex-1 truncate ${
                      m.isPlayed && m.winnerId === m.bId
                        ? "font-bold text-gold"
                        : m.isPlayed
                          ? "text-muted-foreground/50"
                          : ""
                    }`}
                  >
                    {m.bName}
                  </span>
                  {m.isPlayed && m.matchTime && (
                    <span className="text-[8px] tabular-nums text-muted-foreground/40 shrink-0">
                      {formatTime(m.matchTime)}
                    </span>
                  )}
                </div>

                {/* Inline entry */}
                {isExpanded && isAdmin && !m.isPlayed && (
                  <div className="mt-1 mb-1.5 rounded-lg border border-gold/20 bg-gold/[0.02] p-2 space-y-1.5 animate-slide-down">
                    <div className="flex items-center justify-center gap-1">
                      <Input
                        type="number"
                        placeholder="M"
                        min={0}
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                        className="w-14 h-7 text-center text-[11px] font-bold tabular-nums"
                        autoFocus
                      />
                      <span className="text-xs font-bold text-muted-foreground/30">:</span>
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
                        className="w-14 h-7 text-center text-[11px] font-bold tabular-nums"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] font-bold hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98]"
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
                        className="h-7 text-[10px] font-bold hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98]"
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
    );
  }

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-muted/5 flex items-center justify-between hover:bg-muted/10 transition-colors"
      >
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Schedule
          <span className="text-[9px] text-muted-foreground/40 font-normal ml-2">
            {playedCount}/{totalMatches}
          </span>
        </h3>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`text-muted-foreground/40 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div className="max-h-[400px] overflow-y-auto border-t border-border/20">
          <div className="grid grid-cols-2 divide-x divide-border/20">
            <div className="divide-y divide-border/10">
              {leftRounds.map(renderRound)}
            </div>
            <div className="divide-y divide-border/10">
              {rightRounds.map(renderRound)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
