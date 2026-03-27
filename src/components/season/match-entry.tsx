"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordMatchResult, undoMatchResult } from "@/app/actions";
import { toast } from "sonner";

interface Match {
  id: string;
  tier_id: string;
  round_number: number | null;
  match_phase: string;
  pool: string | null;
  wrestler_a_id: string | null;
  wrestler_b_id: string | null;
  tag_team_a_id: string | null;
  tag_team_b_id: string | null;
  stipulation: string | null;
}

interface Tier {
  id: string;
  tier_number: number;
  name: string;
  short_name: string | null;
  divisions: { name: string; division_type: string } | null;
}

export function MatchEntry({
  seasonId,
  tiers,
  matches,
  wrestlerMap,
  tagTeamMap,
  playedCount,
  totalCount,
}: {
  seasonId: string;
  tiers: Tier[];
  matches: Match[];
  wrestlerMap: Record<string, string>;
  tagTeamMap: Record<string, string>;
  playedCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState("");
  const [loading, setLoading] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [notes, setNotes] = useState("");
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);
  const [lastMatchId, setLastMatchId] = useState<string | null>(null);
  const [lastMatchInfo, setLastMatchInfo] = useState<string | null>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const secondsRef = useRef<HTMLInputElement>(null);

  // Group matches by tier
  const matchesByTier = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      if (!map.has(m.tier_id)) map.set(m.tier_id, []);
      map.get(m.tier_id)!.push(m);
    }
    return map;
  }, [matches]);

  // Tiers with remaining matches
  const tiersWithMatches = tiers.filter((t) => matchesByTier.has(t.id));

  // Auto-select first tier with matches
  useEffect(() => {
    if (!selectedTier && tiersWithMatches.length > 0) {
      setSelectedTier(tiersWithMatches[0].id);
    } else if (
      selectedTier &&
      !matchesByTier.has(selectedTier) &&
      tiersWithMatches.length > 0
    ) {
      setSelectedTier(tiersWithMatches[0].id);
    }
  }, [selectedTier, tiersWithMatches, matchesByTier]);

  // Current match (first unplayed in selected tier)
  const currentMatch = selectedTier
    ? matchesByTier.get(selectedTier)?.[0] ?? null
    : null;

  const isTag = currentMatch?.tag_team_a_id != null;
  const nameA = isTag
    ? tagTeamMap[currentMatch?.tag_team_a_id ?? ""] ?? "Team A"
    : wrestlerMap[currentMatch?.wrestler_a_id ?? ""] ?? "Wrestler A";
  const nameB = isTag
    ? tagTeamMap[currentMatch?.tag_team_b_id ?? ""] ?? "Team B"
    : wrestlerMap[currentMatch?.wrestler_b_id ?? ""] ?? "Wrestler B";
  const idA = isTag
    ? currentMatch?.tag_team_a_id ?? ""
    : currentMatch?.wrestler_a_id ?? "";
  const idB = isTag
    ? currentMatch?.tag_team_b_id ?? ""
    : currentMatch?.wrestler_b_id ?? "";

  async function handleWinner(winnerId: string) {
    if (!currentMatch) return;
    const timeSeconds =
      (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
    if (timeSeconds === 0) {
      toast.error("Enter match time");
      minutesRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      await recordMatchResult(currentMatch.id, {
        ...(isTag
          ? { winner_tag_team_id: winnerId }
          : { winner_wrestler_id: winnerId }),
        match_time_seconds: timeSeconds,
        notes: notes || undefined,
      });

      const winnerName = winnerId === idA ? nameA : nameB;
      const loserName = winnerId === idA ? nameB : nameA;

      // Store for undo
      setLastMatchId(currentMatch.id);
      setLastMatchInfo(`${winnerName} def. ${loserName}`);

      setJustSubmitted(winnerName);
      setTimeout(() => setJustSubmitted(null), 1200);
      toast.success(`${winnerName} wins!`);
      setMinutes("");
      setSeconds("");
      setNotes("");
      router.refresh();

      // Focus minutes for next match
      setTimeout(() => minutesRef.current?.focus(), 100);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to record result"
      );
    } finally {
      setLoading(false);
    }
  }

  // Undo last match
  async function handleUndo() {
    if (!lastMatchId) return;
    setLoading(true);
    try {
      await undoMatchResult(lastMatchId);
      toast.success("Match result undone");
      setLastMatchId(null);
      setLastMatchInfo(null);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to undo"
      );
    } finally {
      setLoading(false);
    }
  }

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (loading || !currentMatch) return;

      // Don't trigger if typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        // Tab from minutes to seconds
        if (e.key === "Tab" && !e.shiftKey && target === minutesRef.current) {
          e.preventDefault();
          secondsRef.current?.focus();
          secondsRef.current?.select();
          return;
        }
        // Enter in seconds field = focus back (ready for winner click)
        if (e.key === "Enter" && target === secondsRef.current) {
          e.preventDefault();
          (target as HTMLElement).blur();
          return;
        }
        return;
      }

      // 1 or left arrow = Wrestler A wins
      if (e.key === "1" || e.key === "ArrowLeft") {
        e.preventDefault();
        handleWinner(idA);
      }
      // 2 or right arrow = Wrestler B wins
      else if (e.key === "2" || e.key === "ArrowRight") {
        e.preventDefault();
        handleWinner(idB);
      }
      // Z = undo (Ctrl+Z or Cmd+Z)
      else if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      }
      // T = focus time input
      else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        minutesRef.current?.focus();
        minutesRef.current?.select();
      }
    },
    [loading, currentMatch, idA, idB, lastMatchId]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const currentTier = tiers.find((t) => t.id === selectedTier);
  const remainingInTier = matchesByTier.get(selectedTier)?.length ?? 0;
  const progressPct =
    totalCount > 0 ? Math.round((playedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Overall progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Season Progress</span>
          <span className="tabular-nums font-medium">
            {playedCount} / {totalCount}
            <span className="text-muted-foreground/60 ml-1">
              ({progressPct}%)
            </span>
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Undo bar */}
      {lastMatchId && lastMatchInfo && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            Last: <span className="font-medium text-foreground">{lastMatchInfo}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
            onClick={handleUndo}
            disabled={loading}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
            Undo
          </Button>
        </div>
      )}

      {/* Tier selector */}
      <Select
        value={selectedTier}
        onValueChange={(v) => setSelectedTier(v ?? "")}
      >
        <SelectTrigger className="h-12 text-sm">
          <SelectValue placeholder="Select tier..." />
        </SelectTrigger>
        <SelectContent>
          {tiersWithMatches.map((t) => {
            const left = matchesByTier.get(t.id)?.length ?? 0;
            return (
              <SelectItem key={t.id} value={t.id} className="py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    T{t.tier_number}
                  </span>
                  <span>{t.short_name || t.name}</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] ml-auto"
                  >
                    {left} left
                  </Badge>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Win flash overlay */}
      {justSubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in pointer-events-none">
          <div className="text-center">
            <div className="text-5xl mb-2">🏆</div>
            <div className="text-2xl font-bold text-gold">
              {justSubmitted} wins!
            </div>
          </div>
        </div>
      )}

      {currentMatch ? (
        <Card className="border-border/40 overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-card to-card/80">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">
                {currentTier?.short_name || currentTier?.name}
              </CardTitle>
              <div className="flex gap-1.5">
                {currentMatch.pool && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-border/40"
                  >
                    Pool {currentMatch.pool}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="text-[10px] border-border/40"
                >
                  Rd {currentMatch.round_number}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {remainingInTier} match
                {remainingInTier !== 1 ? "es" : ""} remaining in tier
              </span>
              {currentMatch.stipulation && (
                <Badge className="bg-wwe-red/20 text-wwe-red text-[10px] border-0">
                  {currentMatch.stipulation}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* VS Header */}
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                tap winner
              </span>
            </div>

            {/* Winner selection — large tap targets */}
            <div className="grid grid-cols-2 gap-3">
              <button
                className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-border/40 bg-gradient-to-b from-card to-muted/10 px-3 py-6 text-center transition-all hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98] disabled:opacity-50 min-h-[100px]"
                onClick={() => handleWinner(idA)}
                disabled={loading}
              >
                <span className="text-lg font-bold leading-tight">
                  {nameA}
                </span>
                <span className="hidden sm:block text-[9px] text-muted-foreground/30 mt-1 font-mono">
                  Press 1
                </span>
              </button>

              <button
                className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-border/40 bg-gradient-to-b from-card to-muted/10 px-3 py-6 text-center transition-all hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98] disabled:opacity-50 min-h-[100px]"
                onClick={() => handleWinner(idB)}
                disabled={loading}
              >
                <span className="text-lg font-bold leading-tight">
                  {nameB}
                </span>
                <span className="hidden sm:block text-[9px] text-muted-foreground/30 mt-1 font-mono">
                  Press 2
                </span>
              </button>
            </div>

            {/* Match time — larger inputs */}
            <div className="flex items-center justify-center gap-2">
              <Input
                ref={minutesRef}
                type="number"
                placeholder="Min"
                min={0}
                max={99}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-20 h-12 text-center text-xl font-bold tabular-nums bg-background/50"
              />
              <span className="text-2xl font-bold text-muted-foreground/40">
                :
              </span>
              <Input
                ref={secondsRef}
                type="number"
                placeholder="Sec"
                min={0}
                max={59}
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                className="w-20 h-12 text-center text-xl font-bold tabular-nums bg-background/50"
              />
            </div>

            {/* Notes */}
            <Input
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-background/50"
            />

            {/* Keyboard shortcut hints */}
            <div className="hidden sm:flex items-center justify-center gap-4 text-[9px] text-muted-foreground/30">
              <span>
                <kbd className="rounded border border-border/30 px-1 py-0.5 font-mono">1</kbd>{" "}
                Left wins
              </span>
              <span>
                <kbd className="rounded border border-border/30 px-1 py-0.5 font-mono">2</kbd>{" "}
                Right wins
              </span>
              <span>
                <kbd className="rounded border border-border/30 px-1 py-0.5 font-mono">T</kbd>{" "}
                Focus time
              </span>
              <span>
                <kbd className="rounded border border-border/30 px-1 py-0.5 font-mono">⌘Z</kbd>{" "}
                Undo
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            {tiersWithMatches.length === 0 ? (
              <div>
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-lg font-bold">All matches complete!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {totalCount} matches played this season
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Select a tier to start entering results
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
