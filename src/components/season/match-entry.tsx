"use client";

import { useState, useMemo } from "react";
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
import { recordMatchResult } from "@/app/actions";
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
}: {
  seasonId: string;
  tiers: Tier[];
  matches: Match[];
  wrestlerMap: Record<string, string>;
  tagTeamMap: Record<string, string>;
}) {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState("");
  const [loading, setLoading] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [notes, setNotes] = useState("");

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

      const winnerName =
        winnerId === idA ? nameA : nameB;
      toast.success(`${winnerName} wins!`);
      setMinutes("");
      setSeconds("");
      setNotes("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to record result"
      );
    } finally {
      setLoading(false);
    }
  }

  // Auto-select first tier with matches
  if (!selectedTier && tiersWithMatches.length > 0) {
    setSelectedTier(tiersWithMatches[0].id);
  }

  const currentTier = tiers.find((t) => t.id === selectedTier);
  const remainingInTier = matchesByTier.get(selectedTier)?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Tier selector */}
      <Select value={selectedTier} onValueChange={(v) => setSelectedTier(v ?? "")}>
        <SelectTrigger>
          <SelectValue placeholder="Select tier..." />
        </SelectTrigger>
        <SelectContent>
          {tiersWithMatches.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              T{t.tier_number}: {t.short_name || t.name} (
              {matchesByTier.get(t.id)?.length} left)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {currentMatch ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {currentTier?.short_name || currentTier?.name}
              </CardTitle>
              <div className="flex gap-2">
                {currentMatch.pool && (
                  <Badge variant="outline">Pool {currentMatch.pool}</Badge>
                )}
                <Badge variant="outline">
                  Rd {currentMatch.round_number}
                </Badge>
                <Badge variant="secondary">
                  {remainingInTier} left
                </Badge>
              </div>
            </div>
            {currentMatch.stipulation && (
              <Badge className="mt-1 w-fit bg-wwe-red/20 text-wwe-red">
                {currentMatch.stipulation}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Winner selection — big tap targets */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                variant="outline"
                className="h-20 text-lg font-bold leading-tight"
                onClick={() => handleWinner(idA)}
                disabled={loading}
              >
                {nameA}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-20 text-lg font-bold leading-tight"
                onClick={() => handleWinner(idB)}
                disabled={loading}
              >
                {nameB}
              </Button>
            </div>

            {/* Match time */}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                min={0}
                max={99}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-20 text-center text-lg"
              />
              <span className="text-xl font-bold">:</span>
              <Input
                type="number"
                placeholder="Sec"
                min={0}
                max={59}
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                className="w-20 text-center text-lg"
              />
              <span className="text-sm text-muted-foreground ml-2">
                Match Time
              </span>
            </div>

            {/* Notes */}
            <Input
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {tiersWithMatches.length === 0
              ? "All matches have been played!"
              : "Select a tier to start entering results"}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
