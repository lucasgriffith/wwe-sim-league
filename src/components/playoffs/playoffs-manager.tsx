"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeStandings, type MatchResult } from "@/lib/standings/compute-standings";
import { computePlayoffSeeds, computeTagPlayoffSeeds } from "@/lib/playoffs/seeding";
import { generateBracket, type BracketMatch } from "@/lib/playoffs/bracket";
import { assignStipulation } from "@/lib/stipulations/randomizer";
import { BracketView } from "./bracket-view";
import { bulkCreateMatches, recordMatchResult } from "@/app/actions";
import { toast } from "sonner";
import type { MatchPhase } from "@/types/database";

interface Props {
  season: { id: string; season_number: number };
  tiers: Array<{
    id: string;
    tier_number: number;
    name: string;
    short_name: string | null;
    has_pools: boolean;
    fixed_stipulation: string | null;
    divisions: { name: string; division_type: string } | null;
  }>;
  matches: Array<{
    id: string;
    tier_id: string;
    match_phase: string;
    pool: string | null;
    wrestler_a_id: string | null;
    wrestler_b_id: string | null;
    tag_team_a_id: string | null;
    tag_team_b_id: string | null;
    winner_wrestler_id: string | null;
    winner_tag_team_id: string | null;
    match_time_seconds: number | null;
    stipulation: string | null;
    played_at: string | null;
    round_number: number | null;
  }>;
  wrestlers: Array<{ id: string; name: string }>;
  tagTeams: Array<{ id: string; name: string }>;
  assignments: Array<{
    tier_id: string;
    wrestler_id: string | null;
    tag_team_id: string | null;
    pool: string | null;
  }>;
}

export function PlayoffsManager({
  season,
  tiers,
  matches,
  wrestlers,
  tagTeams,
  assignments,
}: Props) {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState("");
  const [loading, setLoading] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");

  const wrestlerMap = Object.fromEntries(wrestlers.map((w) => [w.id, w.name]));
  const tagTeamMap = Object.fromEntries(tagTeams.map((t) => [t.id, t.name]));

  const tier = tiers.find((t) => t.id === selectedTier);
  const isTag = tier?.divisions?.division_type === "tag";

  // Compute playoff bracket for selected tier
  const bracket = useMemo(() => {
    if (!tier) return null;

    const tierMatches = matches.filter(
      (m) => m.tier_id === tier.id && m.match_phase === "pool_play"
    );
    const tierAssigns = assignments.filter((a) => a.tier_id === tier.id);

    // Check if playoff matches already exist for this tier
    const existingPlayoffMatches = matches.filter(
      (m) =>
        m.tier_id === tier.id &&
        ["quarterfinal", "semifinal", "final"].includes(m.match_phase)
    );

    if (tier.has_pools) {
      // Build standings per pool
      const poolAAssigns = tierAssigns.filter((a) => a.pool === "A");
      const poolBAssigns = tierAssigns.filter((a) => a.pool === "B");
      const poolAMatches = tierMatches
        .filter((m) => m.pool === "A" && m.played_at)
        .map(toMatchResult);
      const poolBMatches = tierMatches
        .filter((m) => m.pool === "B" && m.played_at)
        .map(toMatchResult);

      const poolAStandings = computeStandings(
        poolAAssigns.map((a) => ({
          id: (a.wrestler_id || a.tag_team_id)!,
          name: isTag
            ? tagTeamMap[(a.tag_team_id)!] ?? "?"
            : wrestlerMap[(a.wrestler_id)!] ?? "?",
        })),
        poolAMatches
      );
      const poolBStandings = computeStandings(
        poolBAssigns.map((a) => ({
          id: (a.wrestler_id || a.tag_team_id)!,
          name: isTag
            ? tagTeamMap[(a.tag_team_id)!] ?? "?"
            : wrestlerMap[(a.wrestler_id)!] ?? "?",
        })),
        poolBMatches
      );

      const seeds = computePlayoffSeeds(poolAStandings, poolBStandings);
      const bracketMatches = generateBracket(seeds);

      return { seeds, bracketMatches, existingPlayoffMatches };
    } else {
      // Tag tier: full RR standings
      const allMatchResults = tierMatches
        .filter((m) => m.played_at)
        .map(toMatchResult);

      const standings = computeStandings(
        tierAssigns.map((a) => ({
          id: (a.wrestler_id || a.tag_team_id)!,
          name: isTag
            ? tagTeamMap[(a.tag_team_id)!] ?? "?"
            : wrestlerMap[(a.wrestler_id)!] ?? "?",
        })),
        allMatchResults
      );

      const seeds = computeTagPlayoffSeeds(standings);
      const bracketMatches = generateBracket(seeds);

      return { seeds, bracketMatches, existingPlayoffMatches };
    }
  }, [tier, matches, assignments, wrestlerMap, tagTeamMap, isTag]);

  function toMatchResult(m: Props["matches"][0]): MatchResult {
    return {
      id: m.id,
      wrestlerAId: (m.wrestler_a_id || m.tag_team_a_id)!,
      wrestlerBId: (m.wrestler_b_id || m.tag_team_b_id)!,
      winnerId: (m.winner_wrestler_id || m.winner_tag_team_id)!,
      matchTimeSeconds: m.match_time_seconds ?? 0,
    };
  }

  async function handleGeneratePlayoffMatches() {
    if (!tier || !bracket) return;
    setLoading(true);
    try {
      const usedStipulations: string[] = [];
      const matchInserts = bracket.bracketMatches.map((bm) => {
        const stip = assignStipulation(tier.fixed_stipulation, usedStipulations);
        usedStipulations.push(stip);

        const seedA = bm.seedA;
        const seedB = bm.seedB;

        return {
          season_id: season.id,
          tier_id: tier.id,
          match_phase: bm.round as MatchPhase,
          pool: null,
          stipulation: stip,
          ...(isTag
            ? {
                tag_team_a_id: seedA?.participantId ?? null,
                tag_team_b_id: seedB?.participantId ?? null,
              }
            : {
                wrestler_a_id: seedA?.participantId ?? null,
                wrestler_b_id: seedB?.participantId ?? null,
              }),
        };
      });

      await bulkCreateMatches(matchInserts);
      toast.success("Playoff matches created");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create matches");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPlayoffResult(
    matchId: string,
    winnerId: string
  ) {
    const timeSeconds =
      (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
    if (timeSeconds === 0) {
      toast.error("Enter match time");
      return;
    }
    setLoading(true);
    try {
      await recordMatchResult(matchId, {
        ...(isTag
          ? { winner_tag_team_id: winnerId }
          : { winner_wrestler_id: winnerId }),
        match_time_seconds: timeSeconds,
      });
      toast.success("Result recorded!");
      setMinutes("");
      setSeconds("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record result");
    } finally {
      setLoading(false);
    }
  }

  // Get name from ID
  function getName(id: string | null): string {
    if (!id) return "TBD";
    return (isTag ? tagTeamMap[id] : wrestlerMap[id]) ?? "Unknown";
  }

  return (
    <div className="space-y-6">
      <Select value={selectedTier} onValueChange={(v) => setSelectedTier(v ?? "")}>
        <SelectTrigger className="max-w-lg">
          <SelectValue placeholder="Select tier...">
            {tier
              ? `${tier.divisions?.name} — T${tier.tier_number}: ${tier.short_name || tier.name}`
              : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {tiers.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.divisions?.name} — T{t.tier_number}: {t.short_name || t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {bracket && tier && (
        <div className="space-y-4">
          {/* Seeding */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Seeds - {tier.short_name || tier.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {bracket.seeds.map((seed) => (
                  <div key={seed.seed} className="flex items-center gap-2">
                    <Badge variant="outline" className="w-8 justify-center">
                      {seed.seed}
                    </Badge>
                    <span className="text-sm font-medium">{seed.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(seed.winPct * 100).toFixed(0)}%
                      {seed.pool && ` (Pool ${seed.pool})`}
                      {seed.qualificationType === "wild_card" && " WC"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Generate or show bracket */}
          {bracket.existingPlayoffMatches.length === 0 ? (
            <Button
              onClick={handleGeneratePlayoffMatches}
              disabled={loading}
              className="bg-gold text-black hover:bg-gold-dark font-semibold"
            >
              {loading ? "Generating..." : "Generate Playoff Matches"}
            </Button>
          ) : (
            <div className="space-y-6">
              {/* Visual Bracket */}
              <BracketView
                tierName={tier.short_name || tier.name}
                isTagFinal={!tier.has_pools}
                matches={buildBracketViewData(bracket, tier, matches, wrestlerMap, tagTeamMap, isTag)}
              />

              {/* Match Entry Cards for unplayed matches */}
              {(() => {
                const unplayed = bracket.existingPlayoffMatches.filter((m) => !m.played_at);
                if (unplayed.length === 0) return (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                    <p className="text-sm font-medium text-emerald-400">
                      All playoff matches complete for this tier!
                    </p>
                  </div>
                );

                // Show next match to play (first unplayed with both participants)
                const nextMatch = unplayed.find((m) =>
                  (m.wrestler_a_id || m.tag_team_a_id) && (m.wrestler_b_id || m.tag_team_b_id)
                );
                if (!nextMatch) return (
                  <div className="rounded-lg border border-border/30 bg-card/30 p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Waiting for earlier round results to determine next matchup.
                    </p>
                  </div>
                );

                const aId = (nextMatch.wrestler_a_id || nextMatch.tag_team_a_id) ?? "";
                const bId = (nextMatch.wrestler_b_id || nextMatch.tag_team_b_id) ?? "";
                const aName = getName(aId);
                const bName = getName(bId);

                return (
                  <Card className="border-gold/20 bg-gold/[0.02]">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          Next: {nextMatch.match_phase.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </CardTitle>
                        {nextMatch.stipulation && (
                          <Badge className="bg-wwe-red/20 text-wwe-red text-[10px]">
                            {nextMatch.stipulation}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                          tap winner
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-border/40 bg-gradient-to-b from-card to-muted/10 px-3 py-5 text-center transition-all hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98] disabled:opacity-50"
                          onClick={() => handleRecordPlayoffResult(nextMatch.id, aId)}
                          disabled={loading}
                        >
                          <span className="text-base font-bold leading-tight">{aName}</span>
                        </button>
                        <button
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-border/40 bg-gradient-to-b from-card to-muted/10 px-3 py-5 text-center transition-all hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98] disabled:opacity-50"
                          onClick={() => handleRecordPlayoffResult(nextMatch.id, bId)}
                          disabled={loading}
                        >
                          <span className="text-base font-bold leading-tight">{bName}</span>
                        </button>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          min={0}
                          value={minutes}
                          onChange={(e) => setMinutes(e.target.value)}
                          className="w-20 h-10 text-center text-lg font-bold tabular-nums"
                        />
                        <span className="text-xl font-bold text-muted-foreground/40">:</span>
                        <Input
                          type="number"
                          placeholder="Sec"
                          min={0}
                          max={59}
                          value={seconds}
                          onChange={(e) => setSeconds(e.target.value)}
                          className="w-20 h-10 text-center text-lg font-bold tabular-nums"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Build bracket view data ─────────────────────────────────────────────── */

function buildBracketViewData(
  bracket: {
    seeds: Array<{ seed: number; participantId: string; name: string; winPct: number }>;
    bracketMatches: Array<{ matchKey: string; round: string }>;
    existingPlayoffMatches: Array<{
      id: string;
      match_phase: string;
      wrestler_a_id: string | null;
      wrestler_b_id: string | null;
      tag_team_a_id: string | null;
      tag_team_b_id: string | null;
      winner_wrestler_id: string | null;
      winner_tag_team_id: string | null;
      match_time_seconds: number | null;
      stipulation: string | null;
      played_at: string | null;
      round_number: number | null;
    }>;
  },
  tier: { has_pools: boolean },
  allMatches: Array<{ id: string; match_phase: string; tier_id: string }>,
  wrestlerMap: Record<string, string>,
  tagTeamMap: Record<string, string>,
  isTag: boolean
) {
  const seedMap = Object.fromEntries(
    bracket.seeds.map((s) => [s.participantId, s])
  );

  function getParticipant(id: string | null) {
    if (!id) return null;
    const seed = seedMap[id];
    return {
      id,
      name: (isTag ? tagTeamMap[id] : wrestlerMap[id]) ?? "Unknown",
      seed: seed?.seed ?? 0,
    };
  }

  // Map match_phase to matchKey
  const phaseOrder = { quarterfinal: 0, semifinal: 0, final: 0 };
  const qfMatches = bracket.existingPlayoffMatches.filter((m) => m.match_phase === "quarterfinal");
  const sfMatches = bracket.existingPlayoffMatches.filter((m) => m.match_phase === "semifinal");
  const finalMatches = bracket.existingPlayoffMatches.filter((m) => m.match_phase === "final");

  // Assign matchKeys based on bracket structure
  function assignKey(m: (typeof bracket.existingPlayoffMatches)[0], idx: number, phase: string): string {
    if (phase === "quarterfinal") return `QF${idx + 1}`;
    if (phase === "semifinal") return `SF${idx + 1}`;
    return "Final";
  }

  return bracket.existingPlayoffMatches.map((m) => {
    const phase = m.match_phase;
    const idx =
      phase === "quarterfinal"
        ? qfMatches.indexOf(m)
        : phase === "semifinal"
          ? sfMatches.indexOf(m)
          : 0;

    const aId = m.wrestler_a_id || m.tag_team_a_id;
    const bId = m.wrestler_b_id || m.tag_team_b_id;
    const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;

    return {
      id: m.id,
      matchKey: assignKey(m, idx, phase),
      round: phase,
      participantA: getParticipant(aId),
      participantB: getParticipant(bId),
      winnerId,
      stipulation: m.stipulation,
      matchTime: m.match_time_seconds,
      isPlayed: !!m.played_at,
      isBye: false,
    };
  });
}
