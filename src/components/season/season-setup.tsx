"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createSeason,
  advanceSeasonStatus,
  assignWrestlerToTier,
  removeFromTier,
  bulkCreateMatches,
  bulkAssignToTier,
  resetSeasonAssignments,
  resetSeasonComplete,
  generateAllPlayoffBrackets,
} from "@/app/actions";
import { generateRoundRobin } from "@/lib/scheduling/round-robin";
import {
  getStatusLabel,
  getStatusColor,
  getNextStatus,
} from "@/lib/season/state-machine";
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

// Group tiers by division for the dropdown
function groupTiersByDivision(tiers: Tier[]) {
  const groups: Record<string, { label: string; tiers: Tier[] }> = {};
  for (const t of tiers) {
    const divName = t.divisions?.name ?? "Unknown";
    if (!groups[divName]) {
      groups[divName] = { label: divName, tiers: [] };
    }
    groups[divName].tiers.push(t);
  }
  return Object.values(groups);
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
  tagTeams: {
    id: string;
    name: string;
    wrestler_a: { gender: string } | null;
  }[];
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [showFullResetDialog, setShowFullResetDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [selectedPool, setSelectedPool] = useState<PoolLabel | "">("");

  const currentTier = tiers.find((t) => t.id === selectedTier);
  const tierAssignments = assignments.filter(
    (a) => a.tier_id === selectedTier
  );
  const assignedIds = new Set(
    assignments.map((a) => a.wrestler_id || a.tag_team_id)
  );

  const isTagTier = currentTier?.divisions?.division_type === "tag";

  // Filter available participants by division gender and not already assigned
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

  // Build display labels for selected values
  const selectedTierLabel = currentTier
    ? `${currentTier.divisions?.name} T${currentTier.tier_number}: ${currentTier.short_name || currentTier.name}`
    : undefined;

  const selectedParticipantLabel = isTagTier
    ? tagTeams.find((t) => t.id === selectedParticipant)?.name
    : wrestlers.find((w) => w.id === selectedParticipant)?.name;

  const tierGroups = groupTiersByDivision(tiers);

  async function handleCreateSeason() {
    setLoading(true);
    try {
      await createSeason(nextSeasonNumber);
      toast.success(`Season ${nextSeasonNumber} created`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create season"
      );
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
      toast.success(
        `${selectedParticipantLabel} → ${currentTier?.short_name || currentTier?.name}`
      );
      setSelectedParticipant("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to assign"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    setLoading(true);
    try {
      await removeFromTier(assignmentId);
      toast.success("Removed from tier");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvance() {
    if (!season) return;
    const next = getNextStatus(season.status);
    if (!next) return;

    // Validate: all tiers with assignments need at least 2 participants
    if (next === "pool_play") {
      const underFilled = tiers.filter((t) => {
        const count = assignments.filter((a) => a.tier_id === t.id).length;
        return count > 0 && count < 2;
      });
      if (underFilled.length > 0) {
        toast.error(
          `These tiers need at least 2 participants: ${underFilled.map((t) => t.short_name || t.name).join(", ")}`
        );
        return;
      }
      // Check that at least some tiers have assignments
      const tiersWithAssignments = tiers.filter(
        (t) => assignments.filter((a) => a.tier_id === t.id).length >= 2
      );
      if (tiersWithAssignments.length === 0) {
        toast.error("Assign wrestlers to at least one tier before advancing");
        return;
      }
    }

    setLoading(true);
    try {
      if (next === "pool_play") {
        await generateAndInsertSchedules(season.id);
      }
      if (next === "playoffs") {
        // Auto-generate all playoff brackets across all tiers
        const result = await generateAllPlayoffBrackets(season.id);
        toast.success(
          `Generated brackets for ${result.tiersGenerated} tiers (${result.matchesCreated} matches)`
        );
      }
      await advanceSeasonStatus(season.id, next);
      toast.success(`Advanced to ${getStatusLabel(next)}`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to advance"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResetAssignments() {
    if (!season) return;
    setLoading(true);
    try {
      await resetSeasonAssignments(season.id);
      toast.success("Assignments and matches cleared");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reset"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleFullReset() {
    if (!season) return;
    setLoading(true);
    try {
      await resetSeasonComplete(season.id);
      toast.success("Season deleted — start fresh");
      setShowFullResetDialog(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reset"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRandomizeTagTeams() {
    if (!season) return;
    setLoading(true);
    try {
      // Get tag tiers grouped by gender
      const tagTiers = tiers
        .filter((t) => t.divisions?.division_type === "tag")
        .sort((a, b) => a.tier_number - b.tier_number);

      // Group by gender
      const maleTagTiers = tagTiers.filter(
        (t) => t.divisions?.gender === "male"
      );
      const femaleTagTiers = tagTiers.filter(
        (t) => t.divisions?.gender === "female"
      );

      // Get already-assigned tag team IDs
      const assignedTagIds = new Set(
        assignments
          .filter((a) => a.tag_team_id)
          .map((a) => a.tag_team_id)
      );

      // Categorize unassigned tag teams by gender
      const maleTeams = tagTeams.filter(
        (t) => t.wrestler_a?.gender === "male" && !assignedTagIds.has(t.id)
      );
      const femaleTeams = tagTeams.filter(
        (t) => t.wrestler_a?.gender === "female" && !assignedTagIds.has(t.id)
      );

      // Shuffle
      const shuffledMale = [...maleTeams].sort(() => Math.random() - 0.5);
      const shuffledFemale = [...femaleTeams].sort(() => Math.random() - 0.5);

      const newAssignments: {
        season_id: string;
        tier_id: string;
        tag_team_id: string;
        pool: PoolLabel | null;
      }[] = [];

      // Distribute male teams across male tag tiers
      let mIdx = 0;
      for (const tier of maleTagTiers) {
        for (let i = 0; i < tier.pool_size && mIdx < shuffledMale.length; i++) {
          newAssignments.push({
            season_id: season.id,
            tier_id: tier.id,
            tag_team_id: shuffledMale[mIdx].id,
            pool: null,
          });
          mIdx++;
        }
      }

      // Distribute female teams across female tag tiers
      let fIdx = 0;
      for (const tier of femaleTagTiers) {
        for (let i = 0; i < tier.pool_size && fIdx < shuffledFemale.length; i++) {
          newAssignments.push({
            season_id: season.id,
            tier_id: tier.id,
            tag_team_id: shuffledFemale[fIdx].id,
            pool: null,
          });
          fIdx++;
        }
      }

      if (newAssignments.length > 0) {
        await bulkAssignToTier(newAssignments);
        toast.success(
          `Randomly assigned ${newAssignments.length} tag teams across ${tagTiers.length} tiers`
        );
        router.refresh();
      } else {
        toast.error("No unassigned tag teams to distribute");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to randomize"
      );
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
      for (let i = 0; i < allMatches.length; i += 500) {
        await bulkCreateMatches(allMatches.slice(i, i + 500));
      }
    }
  }

  // Summary of assignments across all tiers
  const assignmentSummary = tiers
    .map((t) => {
      const count = assignments.filter((a) => a.tier_id === t.id).length;
      return { tier: t, count };
    })
    .filter((s) => s.count > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {!season ? (
        <Card>
          <CardHeader>
            <CardTitle>Create Season {nextSeasonNumber}</CardTitle>
            <CardDescription>
              Start a new season to begin assigning wrestlers to tiers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCreateSeason}
              disabled={loading}
              className="bg-gold text-black hover:bg-gold-dark font-semibold"
            >
              {loading ? "Creating..." : `Create Season ${nextSeasonNumber}`}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Season Header */}
          <div className="flex items-center gap-4 flex-wrap">
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
                className="ml-auto"
              >
                Advance to {getStatusLabel(getNextStatus(season.status)!)}
              </Button>
            )}
          </div>

          {season.status === "setup" && (
            <>
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRandomizeTagTeams}
                  disabled={loading}
                  className="text-xs"
                >
                  🎲 Randomize Tag Teams
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetAssignments}
                  disabled={loading}
                  className="text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                >
                  Reset Assignments
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFullResetDialog(true)}
                  disabled={loading}
                  className="text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  Full Reset
                </Button>
              </div>

              {/* Tier Assignment Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Assign Participants to Tiers
                  </CardTitle>
                  <CardDescription>
                    Select a tier, then add wrestlers or tag teams one at a time.
                    Use the Royal Rumble page to bulk-assign by finish order.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    {/* Tier Selector */}
                    <div className="min-w-0 flex-[2] space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Tier
                      </label>
                      <Select
                        value={selectedTier}
                        onValueChange={(v) => {
                          setSelectedTier(v ?? "");
                          setSelectedParticipant("");
                          setSelectedPool("");
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a tier...">
                            {selectedTierLabel}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {tierGroups.map((group) => (
                            <div key={group.label}>
                              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {group.label}
                              </div>
                              {group.tiers.map((t) => {
                                const assignCount = assignments.filter(
                                  (a) => a.tier_id === t.id
                                ).length;
                                return (
                                  <SelectItem key={t.id} value={t.id}>
                                    <span className="flex items-center gap-2">
                                      <span className="text-muted-foreground font-mono text-xs">
                                        T{t.tier_number}
                                      </span>
                                      <span>{t.short_name || t.name}</span>
                                      <span className="text-[10px] text-muted-foreground/50 ml-auto">
                                        {assignCount}/{t.pool_size}
                                      </span>
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Pool Selector */}
                    {selectedTier && currentTier?.has_pools && (
                      <div className="w-28 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Pool
                        </label>
                        <Select
                          value={selectedPool}
                          onValueChange={(v) =>
                            setSelectedPool(v as PoolLabel)
                          }
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

                    {/* Participant Selector */}
                    {selectedTier && (
                      <div className="min-w-0 flex-[2] space-y-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {isTagTier ? "Tag Team" : "Wrestler"}
                        </label>
                        <Select
                          value={selectedParticipant}
                          onValueChange={(v) =>
                            setSelectedParticipant(v ?? "")
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={`Select ${isTagTier ? "tag team" : "wrestler"}...`}>
                              {selectedParticipantLabel}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {availableParticipants.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                            {availableParticipants.length === 0 && (
                              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                                No available{" "}
                                {isTagTier ? "teams" : "wrestlers"}
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <Button
                      onClick={handleAssign}
                      disabled={loading || !selectedParticipant}
                      className="bg-gold text-black hover:bg-gold-dark font-semibold"
                    >
                      Assign
                    </Button>
                  </div>

                  {/* Current Tier Assignments */}
                  {selectedTier && tierAssignments.length > 0 && (
                    <div className="mt-4 rounded-lg border border-border/40 p-4">
                      <h3 className="mb-3 text-sm font-medium">
                        {currentTier?.short_name || currentTier?.name} —{" "}
                        {tierAssignments.length}/{currentTier?.pool_size ?? "?"}
                        {" assigned"}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {tierAssignments.map((a) => {
                          const participant = isTagTier
                            ? tagTeams.find((t) => t.id === a.tag_team_id)
                            : wrestlers.find((w) => w.id === a.wrestler_id);
                          return (
                            <Badge
                              key={a.id}
                              variant="secondary"
                              className="gap-1.5 pr-1"
                            >
                              {participant?.name ?? "Unknown"}
                              {a.pool && (
                                <span className="text-[10px] text-muted-foreground">
                                  ({a.pool})
                                </span>
                              )}
                              <button
                                onClick={() => handleRemoveAssignment(a.id)}
                                className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                                disabled={loading}
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assignment Summary */}
              {assignmentSummary.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Assignment Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {assignmentSummary.map(({ tier, count }) => (
                        <div
                          key={tier.id}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                            count >= tier.pool_size
                              ? "border-emerald-500/20 bg-emerald-500/5"
                              : "border-border/30"
                          }`}
                        >
                          <span className="truncate">
                            <span className="text-muted-foreground font-mono text-xs mr-1.5">
                              T{tier.tier_number}
                            </span>
                            {tier.short_name || tier.name}
                          </span>
                          <span
                            className={`ml-2 text-xs font-mono ${
                              count >= tier.pool_size
                                ? "text-emerald-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {count}/{tier.pool_size}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* Full Reset Confirmation Dialog */}
      {showFullResetDialog && (
        <Dialog open onOpenChange={(open) => !open && setShowFullResetDialog(false)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Full Season Reset</DialogTitle>
              <DialogDescription>
                This will permanently delete the season and ALL associated data
                — tier assignments, match results, and relegation events.{" "}
                <span className="font-semibold text-foreground">
                  This cannot be undone.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowFullResetDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleFullReset}
                disabled={loading}
              >
                {loading ? "Deleting..." : "Delete Everything"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
