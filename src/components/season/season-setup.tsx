"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSeason,
  advanceSeasonStatus,
  assignWrestlerToTier,
  bulkCreateMatches,
} from "@/app/actions";
import { generateRoundRobin } from "@/lib/scheduling/round-robin";
import { getStatusLabel, getStatusColor, getNextStatus } from "@/lib/season/state-machine";
import { toast } from "sonner";
import type { SeasonStatus, PoolLabel, MatchPhase } from "@/types/database";

interface Division {
  name: string;
  gender: string;
  division_type: string;
}

interface Tier {
  id: string;
  tier_number: number;
  name: string;
  short_name: string | null;
  pool_size: number;
  has_pools: boolean;
  division_id: string;
  divisions: Division | null;
}

interface Season {
  id: string;
  season_number: number;
  status: SeasonStatus;
}

interface Assignment {
  id: string;
  tier_id: string;
  wrestler_id: string | null;
  tag_team_id: string | null;
  pool: string | null;
  seed: number | null;
}

export function SeasonSetup({
  season,
  nextSeasonNumber,
  tiers,
  wrestlers,
  tagTeams,
  assignments,
}: {
  season: Season | null;
  nextSeasonNumber: number;
  tiers: Tier[];
  wrestlers: { id: string; name: string; gender: string }[];
  tagTeams: { id: string; name: string; wrestler_a: { gender: string } | null }[];
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [selectedPool, setSelectedPool] = useState<PoolLabel | "">("");

  const currentTier = tiers.find((t) => t.id === selectedTier);
  const tierAssignments = assignments.filter((a) => a.tier_id === selectedTier);
  const assignedIds = new Set(
    assignments.map((a) => a.wrestler_id || a.tag_team_id)
  );

  const isTagTier =
    currentTier?.divisions?.division_type === "tag";

  // Filter available participants by division gender and not already assigned to this tier
  const tierAssignedIds = new Set(
    tierAssignments.map((a) => a.wrestler_id || a.tag_team_id)
  );

  const availableParticipants = isTagTier
    ? tagTeams.filter((t) => !tierAssignedIds.has(t.id))
    : wrestlers.filter(
        (w) =>
          w.gender === currentTier?.divisions?.gender &&
          !tierAssignedIds.has(w.id)
      );

  async function handleCreateSeason() {
    setLoading(true);
    try {
      await createSeason(nextSeasonNumber);
      toast.success(`Season ${nextSeasonNumber} created`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create season");
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign() {
    if (!season || !selectedTier || !selectedParticipant) return;
    setLoading(true);
    try {
      await assignWrestlerToTier({
        season_id: season.id,
        tier_id: selectedTier,
        ...(isTagTier
          ? { tag_team_id: selectedParticipant }
          : { wrestler_id: selectedParticipant }),
        pool: (currentTier?.has_pools && selectedPool
          ? selectedPool
          : null) as PoolLabel | null,
      });
      toast.success("Assigned to tier");
      setSelectedParticipant("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvance() {
    if (!season) return;
    const next = getNextStatus(season.status);
    if (!next) return;

    setLoading(true);
    try {
      // If advancing to pool_play, generate schedules first
      if (next === "pool_play") {
        await generateAndInsertSchedules(season.id);
      }
      await advanceSeasonStatus(season.id, next);
      toast.success(`Advanced to ${getStatusLabel(next)}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to advance");
    } finally {
      setLoading(false);
    }
  }

  async function generateAndInsertSchedules(seasonId: string) {
    const allMatches: {
      season_id: string;
      tier_id: string;
      round_number: number;
      match_phase: MatchPhase;
      pool: PoolLabel | null;
      wrestler_a_id?: string | null;
      wrestler_b_id?: string | null;
      tag_team_a_id?: string | null;
      tag_team_b_id?: string | null;
    }[] = [];

    for (const tier of tiers) {
      const tierAssigns = assignments.filter((a) => a.tier_id === tier.id);
      if (tierAssigns.length < 2) continue;

      const isTag = tier.divisions?.division_type === "tag";

      if (tier.has_pools) {
        // Singles tiers: generate per pool
        for (const pool of ["A", "B"] as const) {
          const poolAssigns = tierAssigns.filter((a) => a.pool === pool);
          const ids = poolAssigns.map(
            (a) => (a.wrestler_id || a.tag_team_id)!
          );
          if (ids.length < 2) continue;

          const schedule = generateRoundRobin(ids);
          for (const match of schedule) {
            allMatches.push({
              season_id: seasonId,
              tier_id: tier.id,
              round_number: match.round,
              match_phase: "pool_play",
              pool,
              ...(isTag
                ? {
                    tag_team_a_id: match.participantA,
                    tag_team_b_id: match.participantB,
                  }
                : {
                    wrestler_a_id: match.participantA,
                    wrestler_b_id: match.participantB,
                  }),
            });
          }
        }
      } else {
        // Tag tiers: full round robin
        const ids = tierAssigns.map(
          (a) => (a.wrestler_id || a.tag_team_id)!
        );
        const schedule = generateRoundRobin(ids);
        for (const match of schedule) {
          allMatches.push({
            season_id: seasonId,
            tier_id: tier.id,
            round_number: match.round,
            match_phase: "pool_play",
            pool: null,
            ...(isTag
              ? {
                  tag_team_a_id: match.participantA,
                  tag_team_b_id: match.participantB,
                }
              : {
                  wrestler_a_id: match.participantA,
                  wrestler_b_id: match.participantB,
                }),
          });
        }
      }
    }

    if (allMatches.length > 0) {
      // Batch insert in chunks of 500
      for (let i = 0; i < allMatches.length; i += 500) {
        await bulkCreateMatches(allMatches.slice(i, i + 500));
      }
    }
  }

  return (
    <div className="space-y-6">
      {!season ? (
        <Card>
          <CardHeader>
            <CardTitle>Create Season {nextSeasonNumber}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleCreateSeason} disabled={loading}>
              {loading ? "Creating..." : `Create Season ${nextSeasonNumber}`}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">
              Season {season.season_number}
            </h2>
            <Badge className={getStatusColor(season.status)}>
              {getStatusLabel(season.status)}
            </Badge>
            {getNextStatus(season.status) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAdvance}
                disabled={loading}
              >
                Advance to {getStatusLabel(getNextStatus(season.status)!)}
              </Button>
            )}
          </div>

          {season.status === "setup" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Assign Participants to Tiers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="w-64 space-y-1">
                    <label className="text-sm text-muted-foreground">
                      Tier
                    </label>
                    <Select
                      value={selectedTier}
                      onValueChange={(v) => setSelectedTier(v ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tiers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.divisions?.name} - T{t.tier_number}:{" "}
                            {t.short_name || t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTier && currentTier?.has_pools && (
                    <div className="w-24 space-y-1">
                      <label className="text-sm text-muted-foreground">
                        Pool
                      </label>
                      <Select
                        value={selectedPool}
                        onValueChange={(v) => setSelectedPool(v as PoolLabel)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pool" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">Pool A</SelectItem>
                          <SelectItem value="B">Pool B</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedTier && (
                    <div className="flex-1 space-y-1">
                      <label className="text-sm text-muted-foreground">
                        {isTagTier ? "Tag Team" : "Wrestler"}
                      </label>
                      <Select
                        value={selectedParticipant}
                        onValueChange={(v) => setSelectedParticipant(v ?? "")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableParticipants.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    onClick={handleAssign}
                    disabled={loading || !selectedParticipant}
                  >
                    Assign
                  </Button>
                </div>

                {selectedTier && tierAssignments.length > 0 && (
                  <div className="mt-4">
                    <h3 className="mb-2 text-sm font-medium">
                      Assigned ({tierAssignments.length}/
                      {currentTier?.pool_size ?? "?"})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {tierAssignments.map((a) => {
                        const participant = isTagTier
                          ? tagTeams.find(
                              (t) => t.id === a.tag_team_id
                            )
                          : wrestlers.find(
                              (w) => w.id === a.wrestler_id
                            );
                        return (
                          <Badge key={a.id} variant="secondary">
                            {participant?.name ?? "Unknown"}
                            {a.pool && ` (${a.pool})`}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
