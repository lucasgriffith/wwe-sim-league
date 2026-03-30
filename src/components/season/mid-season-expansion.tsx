"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { addWrestlersToSeasonMidway } from "@/app/actions";
import { toast } from "sonner";
import type { PoolLabel } from "@/types/database";

interface Tier {
  id: string;
  name: string;
  short_name: string | null;
  tier_number: number;
  pool_size: number;
  has_pools: boolean;
  slug: string;
  divisions: { name: string; gender: string; division_type: string } | null;
}

interface Wrestler {
  id: string;
  name: string;
  gender: string;
  overall_rating: number | null;
  image_url: string | null;
}

interface Assignment {
  tier_id: string;
  wrestler_id: string | null;
  tag_team_id: string | null;
  pool: string | null;
}

interface Props {
  seasonId: string;
  tiers: Tier[];
  assignments: Assignment[];
  unassignedWrestlers: Wrestler[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MidSeasonExpansion({
  seasonId,
  tiers,
  assignments,
  unassignedWrestlers,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"rumble" | "preview" | "done">("rumble");
  const [loading, setLoading] = useState(false);

  // Group unassigned by gender
  const unassignedMale = unassignedWrestlers.filter((w) => w.gender === "male");
  const unassignedFemale = unassignedWrestlers.filter((w) => w.gender === "female");

  // Rumble state: positions per wrestler
  const [positions, setPositions] = useState<Record<string, string>>({});

  // Computed: tiers with vacant spots
  const tiersWithVacancies = useMemo(() => {
    return tiers
      .filter((t) => t.divisions?.division_type === "singles")
      .map((t) => {
        const assigned = assignments.filter((a) => a.tier_id === t.id).length;
        const vacant = t.pool_size - assigned;
        return { ...t, assigned, vacant };
      })
      .filter((t) => t.vacant > 0)
      .sort((a, b) => a.tier_number - b.tier_number);
  }, [tiers, assignments]);

  const maleVacancies = tiersWithVacancies.filter((t) => t.divisions?.gender === "male");
  const femaleVacancies = tiersWithVacancies.filter((t) => t.divisions?.gender === "female");

  // Generate random positions for a gender group
  function randomizePositions(wrestlers: Wrestler[]) {
    const shuffled = shuffle(wrestlers);
    const newPositions = { ...positions };
    shuffled.forEach((w, i) => {
      newPositions[w.id] = String(i + 1);
    });
    setPositions(newPositions);
  }

  // Compute tier assignments from positions
  const tierPreview = useMemo(() => {
    const result: Array<{
      tier: Tier & { vacant: number; assigned: number };
      wrestlers: Array<{ id: string; name: string; pool: PoolLabel | null }>;
    }> = [];

    // Process male and female separately
    for (const [gender, vacancies, unassigned] of [
      ["male", maleVacancies, unassignedMale],
      ["female", femaleVacancies, unassignedFemale],
    ] as const) {
      // Sort wrestlers by position
      const sorted = [...unassigned]
        .filter((w) => positions[w.id] && positions[w.id] !== "")
        .sort((a, b) => {
          const posA = parseInt(positions[a.id]) || 999;
          const posB = parseInt(positions[b.id]) || 999;
          return posA - posB;
        });

      let idx = 0;
      for (const tier of vacancies) {
        const wrestlers: Array<{ id: string; name: string; pool: PoolLabel | null }> = [];
        const spotsToFill = Math.min(tier.vacant, sorted.length - idx);

        if (tier.has_pools) {
          // Count existing per pool
          const existingA = assignments.filter(
            (a) => a.tier_id === tier.id && a.pool === "A"
          ).length;
          const existingB = assignments.filter(
            (a) => a.tier_id === tier.id && a.pool === "B"
          ).length;
          let pA = existingA;
          let pB = existingB;

          for (let i = 0; i < spotsToFill && idx < sorted.length; i++) {
            const pool: PoolLabel = pA <= pB ? "A" : "B";
            wrestlers.push({
              id: sorted[idx].id,
              name: sorted[idx].name,
              pool,
            });
            if (pool === "A") pA++;
            else pB++;
            idx++;
          }
        } else {
          for (let i = 0; i < spotsToFill && idx < sorted.length; i++) {
            wrestlers.push({
              id: sorted[idx].id,
              name: sorted[idx].name,
              pool: null,
            });
            idx++;
          }
        }

        if (wrestlers.length > 0) {
          result.push({ tier, wrestlers });
        }
      }
    }

    return result;
  }, [positions, maleVacancies, femaleVacancies, unassignedMale, unassignedFemale, assignments]);

  const totalNewWrestlers = tierPreview.reduce(
    (sum, tp) => sum + tp.wrestlers.length,
    0
  );
  const totalNewMatches = useMemo(() => {
    let total = 0;
    for (const { tier, wrestlers: newWrestlers } of tierPreview) {
      const existingCount = tier.assigned;
      if (tier.has_pools) {
        // Estimate: each new wrestler plays existing in their pool + other new in pool
        for (const pool of ["A", "B"]) {
          const existingInPool = assignments.filter(
            (a) => a.tier_id === tier.id && a.pool === pool
          ).length;
          const newInPool = newWrestlers.filter((w) => w.pool === pool).length;
          total += newInPool * existingInPool; // new vs existing
          total += (newInPool * (newInPool - 1)) / 2; // new vs new
        }
      } else {
        const n = newWrestlers.length;
        total += n * existingCount; // new vs existing
        total += (n * (n - 1)) / 2; // new vs new
      }
    }
    return total;
  }, [tierPreview, assignments]);

  async function handleAssign() {
    if (tierPreview.length === 0) return;
    setLoading(true);
    try {
      const newAssignments = tierPreview.flatMap(({ tier, wrestlers }) =>
        wrestlers.map((w) => ({
          tier_id: tier.id,
          wrestler_id: w.id,
          pool: w.pool,
        }))
      );

      const result = await addWrestlersToSeasonMidway(seasonId, newAssignments);
      toast.success(
        `Added ${result.assigned} wrestlers, created ${result.matchesCreated} catch-up matches!`
      );
      setStep("done");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to expand season"
      );
    } finally {
      setLoading(false);
    }
  }

  if (unassignedWrestlers.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            All active wrestlers are already assigned to tiers. Add new
            wrestlers to the roster first.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (step === "done") {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="py-8 text-center">
          <p className="text-lg font-bold text-emerald-400">
            Expansion Complete!
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            New wrestlers have been assigned and catch-up matches have been
            generated.
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push("/tiers")}
          >
            View Tiers
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{unassignedMale.length}</div>
            <div className="text-xs text-muted-foreground">Unassigned Males</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{unassignedFemale.length}</div>
            <div className="text-xs text-muted-foreground">Unassigned Females</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">
              {maleVacancies.reduce((s, t) => s + t.vacant, 0) +
                femaleVacancies.reduce((s, t) => s + t.vacant, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Vacant Tier Spots</div>
          </CardContent>
        </Card>
      </div>

      {/* Vacant Tiers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tiers with Open Spots</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tiersWithVacancies.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-md border border-border/30 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-mono text-[10px] text-muted-foreground mr-1.5">
                    T{t.tier_number}
                  </span>
                  {t.short_name || t.name}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-gold/10 text-gold"
                >
                  {t.vacant} open
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rumble Step */}
      {step === "rumble" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expansion Rumble</CardTitle>
            <CardDescription>
              Randomize finishing positions for new wrestlers. Position 1 = best
              tier placement. Wrestlers are assigned to tiers with open spots,
              best finishers get the highest available tiers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Male group */}
            {unassignedMale.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold">
                    Men ({unassignedMale.length})
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => randomizePositions(unassignedMale)}
                  >
                    🎲 Randomize
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {unassignedMale.map((w) => {
                    const pos = positions[w.id] ?? "";
                    return (
                      <div
                        key={w.id}
                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
                          pos !== ""
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "border-border/30"
                        }`}
                      >
                        <Input
                          type="number"
                          min={1}
                          max={unassignedMale.length}
                          value={pos}
                          onChange={(e) =>
                            setPositions({
                              ...positions,
                              [w.id]: e.target.value,
                            })
                          }
                          placeholder="#"
                          className="w-14 h-7 text-center text-xs font-mono tabular-nums bg-background/50"
                        />
                        <span className="text-xs font-medium truncate flex-1">
                          {w.name}
                        </span>
                        {w.overall_rating && (
                          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                            {w.overall_rating}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Female group */}
            {unassignedFemale.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold">
                    Women ({unassignedFemale.length})
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => randomizePositions(unassignedFemale)}
                  >
                    🎲 Randomize
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {unassignedFemale.map((w) => {
                    const pos = positions[w.id] ?? "";
                    return (
                      <div
                        key={w.id}
                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
                          pos !== ""
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "border-border/30"
                        }`}
                      >
                        <Input
                          type="number"
                          min={1}
                          max={unassignedFemale.length}
                          value={pos}
                          onChange={(e) =>
                            setPositions({
                              ...positions,
                              [w.id]: e.target.value,
                            })
                          }
                          placeholder="#"
                          className="w-14 h-7 text-center text-xs font-mono tabular-nums bg-background/50"
                        />
                        <span className="text-xs font-medium truncate flex-1">
                          {w.name}
                        </span>
                        {w.overall_rating && (
                          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                            {w.overall_rating}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Button
              onClick={() => setStep("preview")}
              disabled={
                Object.values(positions).filter((v) => v !== "").length === 0
              }
              className="bg-gold text-black hover:bg-gold-dark font-semibold"
            >
              Preview Tier Assignments →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preview Step */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview Assignments</CardTitle>
            <CardDescription>
              {totalNewWrestlers} wrestlers will be added across{" "}
              {tierPreview.length} tiers, generating ~{totalNewMatches} catch-up
              matches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tierPreview.map(({ tier, wrestlers }) => (
              <div
                key={tier.id}
                className="rounded-lg border border-border/30 p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    T{tier.tier_number}
                  </span>
                  <span className="text-sm font-medium">
                    {tier.short_name || tier.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto">
                    +{wrestlers.length} new ({tier.assigned} existing)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wrestlers.map((w) => (
                    <Badge
                      key={w.id}
                      variant="secondary"
                      className="text-xs bg-gold/10 text-gold border-gold/20"
                    >
                      {w.name}
                      {w.pool && (
                        <span className="text-[9px] text-gold/60 ml-1">
                          ({w.pool})
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}

            {tierPreview.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No wrestlers would be assigned. Make sure positions are filled
                and there are vacant tier spots.
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("rumble")}>
                ← Back
              </Button>
              <Button
                onClick={handleAssign}
                disabled={loading || tierPreview.length === 0}
                className="bg-gold text-black hover:bg-gold-dark font-semibold"
              >
                {loading
                  ? "Assigning & generating matches..."
                  : `Confirm: Add ${totalNewWrestlers} Wrestlers + ${totalNewMatches} Matches`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
