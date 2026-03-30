"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { recordMatchResult } from "@/app/actions";
import { toast } from "sonner";

interface ScheduleMatch {
  id: string;
  tierId: string;
  tierLabel: string;
  tierName: string;
  pool: string | null;
  round: number | null;
  nameA: string;
  nameB: string;
  idA: string;
  idB: string;
  isTag: boolean;
}

export function UpcomingSchedule({
  matches,
  isAdmin,
}: {
  matches: ScheduleMatch[];
  isAdmin: boolean;
}) {
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRecordResult(match: ScheduleMatch, winnerId: string) {
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
        const winnerName = winnerId === match.idA ? match.nameA : match.nameB;
        toast.success(`${winnerName} wins!`);
        setExpandedMatch(null);
        setMinutes("");
        setSeconds("");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to record result"
        );
      }
    });
  }

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/40 bg-card/30 px-4 py-12 text-center">
        <div className="text-3xl mb-2">🎉</div>
        <p className="text-sm text-muted-foreground">
          No upcoming matches — all done!
        </p>
      </div>
    );
  }

  // Group by tier for easier scanning
  const grouped: Array<{ tierLabel: string; tierName: string; matches: ScheduleMatch[] }> = [];
  for (const m of matches) {
    const last = grouped[grouped.length - 1];
    if (last && last.tierLabel === m.tierLabel) {
      last.matches.push(m);
    } else {
      grouped.push({ tierLabel: m.tierLabel, tierName: m.tierName, matches: [m] });
    }
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {grouped.map((group) => (
        <div key={group.tierLabel}>
          <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10">
            <span className="text-[10px] font-mono text-muted-foreground/50">
              {group.tierLabel}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {group.tierName}
            </span>
            <span className="text-[10px] text-muted-foreground/40 ml-auto">
              {group.matches.length} left
            </span>
          </div>

          <div className="space-y-1.5">
            {group.matches.map((m) => {
              const isExpanded = expandedMatch === m.id;
              return (
                <div key={m.id}>
                  <div
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all cursor-pointer ${
                      isExpanded
                        ? "border-gold/30 bg-gold/5"
                        : "border-border/30 hover:border-border/50 hover:bg-card/50"
                    }`}
                    onClick={() => {
                      if (!isAdmin) return;
                      setExpandedMatch(isExpanded ? null : m.id);
                      setMinutes("");
                      setSeconds("");
                    }}
                  >
                    {m.pool && (
                      <span className="text-[9px] font-mono text-muted-foreground/40">
                        {m.pool}
                      </span>
                    )}
                    <span className="font-medium text-xs truncate flex-1">
                      {m.nameA}
                    </span>
                    <span className="text-[9px] text-muted-foreground/40 font-medium">
                      vs
                    </span>
                    <span className="font-medium text-xs truncate flex-1 text-right">
                      {m.nameB}
                    </span>
                    {isAdmin && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`shrink-0 text-muted-foreground/30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    )}
                  </div>

                  {/* Inline entry panel */}
                  {isExpanded && isAdmin && (
                    <div className="mt-1 rounded-lg border border-gold/20 bg-gold/[0.02] p-3 space-y-3 animate-slide-down">
                      {/* Time input */}
                      <div className="flex items-center justify-center gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          min={0}
                          value={minutes}
                          onChange={(e) => setMinutes(e.target.value)}
                          className="w-16 h-9 text-center text-sm font-bold tabular-nums"
                          autoFocus
                        />
                        <span className="text-lg font-bold text-muted-foreground/30">:</span>
                        <Input
                          type="number"
                          placeholder="Sec"
                          min={0}
                          max={59}
                          value={seconds}
                          onChange={(e) => setSeconds(e.target.value)}
                          className="w-16 h-9 text-center text-sm font-bold tabular-nums"
                        />
                      </div>

                      {/* Winner buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-12 text-xs font-bold border-border/40 hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRecordResult(m, m.idA);
                          }}
                          disabled={isPending}
                        >
                          {m.nameA}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-12 text-xs font-bold border-border/40 hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRecordResult(m, m.idB);
                          }}
                          disabled={isPending}
                        >
                          {m.nameB}
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
  );
}
