"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { bulkAssignToTier } from "@/app/actions";
import { toast } from "sonner";
import type { PoolLabel } from "@/types/database";

interface Wrestler {
  id: string;
  name: string;
  gender: string;
  overall_rating: number | null;
}

interface Tier {
  id: string;
  tier_number: number;
  name: string;
  short_name: string | null;
  pool_size: number;
  has_pools: boolean;
  division_id: string;
  divisions: { name: string; gender: string; division_type: string } | null;
}

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function RumbleSeeding({
  wrestlers,
  tagTeams,
  tiers,
  season,
}: {
  wrestlers: Wrestler[];
  tagTeams: Array<{
    id: string;
    name: string;
    wrestler_a: { gender: string } | null;
  }>;
  tiers: Tier[];
  season: { id: string; season_number: number } | null;
}) {
  const router = useRouter();
  const [gender, setGender] = useState<"male" | "female">("male");
  const [rumbleGroup, setRumbleGroup] = useState<Wrestler[]>([]);
  const [finishPositions, setFinishPositions] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(false);
  const [assigned, setAssigned] = useState(false);

  const genderWrestlers = wrestlers.filter((w) => w.gender === gender);

  // Get relevant tiers for this gender
  const singlesTiers = useMemo(
    () =>
      tiers
        .filter(
          (t) =>
            t.divisions?.division_type === "singles" &&
            t.divisions?.gender === gender
        )
        .sort((a, b) => a.tier_number - b.tier_number),
    [tiers, gender]
  );

  const totalSlots = singlesTiers.reduce((sum, t) => sum + t.pool_size, 0);

  // Randomize a group of up to 30 wrestlers
  function handleRandomize() {
    const shuffled = shuffle(genderWrestlers);
    const group = shuffled.slice(0, Math.min(30, shuffled.length));
    setRumbleGroup(group);
    setFinishPositions({});
    setAssigned(false);
  }

  // Randomize ALL wrestlers of this gender (for when you have more than 30)
  function handleRandomizeAll() {
    const shuffled = shuffle(genderWrestlers);
    setRumbleGroup(shuffled);
    setFinishPositions({});
    setAssigned(false);
  }

  function updatePosition(wrestlerId: string, value: string) {
    setFinishPositions((prev) => ({
      ...prev,
      [wrestlerId]: value,
    }));
  }

  // Validate all positions are filled and unique
  const positionValues = Object.entries(finishPositions)
    .filter(([, v]) => v !== "")
    .map(([id, v]) => ({ id, pos: parseInt(v) }))
    .filter(({ pos }) => !isNaN(pos));

  const allFilled = positionValues.length === rumbleGroup.length;
  const posNums = positionValues.map((p) => p.pos);
  const hasDuplicates = new Set(posNums).size !== posNums.length;
  const hasInvalid = posNums.some((p) => p < 1 || p > rumbleGroup.length);

  // Sort wrestlers by their finish position for the preview
  const sortedByFinish = useMemo(() => {
    if (!allFilled || hasDuplicates || hasInvalid) return [];
    return [...positionValues].sort((a, b) => a.pos - b.pos);
  }, [positionValues, allFilled, hasDuplicates, hasInvalid]);

  // Build tier assignment preview
  const tierPreview = useMemo(() => {
    if (sortedByFinish.length === 0) return [];

    const preview: Array<{
      tier: Tier;
      wrestlers: Array<{ id: string; name: string; pool: PoolLabel | null }>;
    }> = [];

    let idx = 0;
    for (const tier of singlesTiers) {
      const tierWrestlers: Array<{
        id: string;
        name: string;
        pool: PoolLabel | null;
      }> = [];

      const tierSize = tier.pool_size;

      if (tier.has_pools) {
        let poolACount = 0;
        let poolBCount = 0;
        for (let i = 0; i < tierSize && idx < sortedByFinish.length; i++) {
          const w = wrestlers.find((w) => w.id === sortedByFinish[idx].id);
          const pool: PoolLabel = poolACount <= poolBCount ? "A" : "B";
          tierWrestlers.push({
            id: sortedByFinish[idx].id,
            name: w?.name ?? "Unknown",
            pool,
          });
          if (pool === "A") poolACount++;
          else poolBCount++;
          idx++;
        }
      } else {
        for (let i = 0; i < tierSize && idx < sortedByFinish.length; i++) {
          const w = wrestlers.find((w) => w.id === sortedByFinish[idx].id);
          tierWrestlers.push({
            id: sortedByFinish[idx].id,
            name: w?.name ?? "Unknown",
            pool: null,
          });
          idx++;
        }
      }

      if (tierWrestlers.length > 0) {
        preview.push({ tier, wrestlers: tierWrestlers });
      }
    }

    return preview;
  }, [sortedByFinish, singlesTiers, wrestlers]);

  async function handleAutoAssign() {
    if (!season) {
      toast.error("Create a season in Season Setup first");
      return;
    }

    if (!allFilled || hasDuplicates || hasInvalid) {
      toast.error("Fix position errors before assigning");
      return;
    }

    setLoading(true);
    try {
      const assignments: {
        season_id: string;
        tier_id: string;
        wrestler_id: string;
        pool: PoolLabel | null;
        seed: number;
      }[] = [];

      let idx = 0;
      for (const tier of singlesTiers) {
        const tierSize = tier.pool_size;

        if (tier.has_pools) {
          let poolACount = 0;
          let poolBCount = 0;
          for (
            let i = 0;
            i < tierSize && idx < sortedByFinish.length;
            i++
          ) {
            const pool: PoolLabel = poolACount <= poolBCount ? "A" : "B";
            assignments.push({
              season_id: season.id,
              tier_id: tier.id,
              wrestler_id: sortedByFinish[idx].id,
              pool,
              seed: idx + 1,
            });
            if (pool === "A") poolACount++;
            else poolBCount++;
            idx++;
          }
        } else {
          for (
            let i = 0;
            i < tierSize && idx < sortedByFinish.length;
            i++
          ) {
            assignments.push({
              season_id: season.id,
              tier_id: tier.id,
              wrestler_id: sortedByFinish[idx].id,
              pool: null,
              seed: idx + 1,
            });
            idx++;
          }
        }
      }

      if (assignments.length > 0) {
        await bulkAssignToTier(assignments);
        toast.success(
          `Assigned ${assignments.length} wrestlers across ${singlesTiers.length} tiers`
        );
        setAssigned(true);
        router.refresh();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to assign"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {!season && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4">
            <p className="text-sm text-amber-400">
              ⚠ Create a season in{" "}
              <a href="/season/setup" className="underline hover:text-amber-300">
                Season Setup
              </a>{" "}
              first before running the Royal Rumble.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Gender Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          <Button
            variant={gender === "male" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setGender("male");
              setRumbleGroup([]);
              setFinishPositions({});
              setAssigned(false);
            }}
            className={`text-xs ${gender !== "male" ? "border-border/40 text-muted-foreground" : ""}`}
          >
            Men&apos;s Rumble
          </Button>
          <Button
            variant={gender === "female" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setGender("female");
              setRumbleGroup([]);
              setFinishPositions({});
              setAssigned(false);
            }}
            className={`text-xs ${gender !== "female" ? "border-border/40 text-muted-foreground" : ""}`}
          >
            Women&apos;s Rumble
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {genderWrestlers.length} {gender === "male" ? "men" : "women"}{" "}
          available · {singlesTiers.length} tiers · {totalSlots} total slots
        </span>
      </div>

      {/* Randomize Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1: Randomize Rumble Group</CardTitle>
          <CardDescription>
            Randomly select wrestlers for the Royal Rumble. Run the Rumble in-game,
            then enter each wrestler&apos;s finishing position below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              onClick={handleRandomize}
              className="bg-gold text-black hover:bg-gold-dark font-semibold"
              disabled={genderWrestlers.length === 0}
            >
              Randomize 30
            </Button>
            {genderWrestlers.length > 30 && (
              <Button
                onClick={handleRandomizeAll}
                variant="outline"
                disabled={genderWrestlers.length === 0}
              >
                Randomize All ({genderWrestlers.length})
              </Button>
            )}
            {rumbleGroup.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setRumbleGroup([]);
                  setFinishPositions({});
                  setAssigned(false);
                }}
                className="text-muted-foreground"
              >
                Clear
              </Button>
            )}
          </div>
          {rumbleGroup.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {rumbleGroup.length} wrestlers selected. Enter 1 = winner (best
              finisher → Tier 1), {rumbleGroup.length} = first eliminated
              (lowest tier).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Finish Position Entry */}
      {rumbleGroup.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Step 2: Enter Finishing Positions
            </CardTitle>
            <CardDescription>
              1 = Rumble winner (highest tier), {rumbleGroup.length} = first
              eliminated (lowest tier). Each position must be unique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {rumbleGroup.map((wrestler) => {
                const pos = finishPositions[wrestler.id] ?? "";
                const posNum = parseInt(pos);
                const isDuplicate =
                  pos !== "" &&
                  !isNaN(posNum) &&
                  positionValues.filter((p) => p.pos === posNum).length > 1;
                const isOutOfRange =
                  pos !== "" &&
                  !isNaN(posNum) &&
                  (posNum < 1 || posNum > rumbleGroup.length);

                return (
                  <div
                    key={wrestler.id}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                      isDuplicate || isOutOfRange
                        ? "border-red-500/40 bg-red-500/5"
                        : pos !== ""
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-border/30"
                    }`}
                  >
                    <Input
                      type="number"
                      min={1}
                      max={rumbleGroup.length}
                      value={pos}
                      onChange={(e) =>
                        updatePosition(wrestler.id, e.target.value)
                      }
                      placeholder="#"
                      className="w-16 h-8 text-center text-sm font-mono tabular-nums bg-background/50"
                    />
                    <span className="text-sm font-medium flex-1">
                      {wrestler.name}
                    </span>
                    {wrestler.overall_rating && (
                      <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                        OVR {wrestler.overall_rating}
                      </span>
                    )}
                    {isDuplicate && (
                      <span className="text-[10px] text-red-400">
                        Duplicate
                      </span>
                    )}
                    {isOutOfRange && (
                      <span className="text-[10px] text-red-400">
                        Out of range
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                {positionValues.length}/{rumbleGroup.length} filled
              </span>
              {hasDuplicates && (
                <span className="text-red-400">⚠ Duplicate positions</span>
              )}
              {hasInvalid && (
                <span className="text-red-400">
                  ⚠ Positions must be 1–{rumbleGroup.length}
                </span>
              )}
              {allFilled && !hasDuplicates && !hasInvalid && (
                <span className="text-emerald-400">✓ All positions valid</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tier Assignment Preview */}
      {tierPreview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Step 3: Preview Tier Assignments
            </CardTitle>
            <CardDescription>
              Based on finishing positions, wrestlers will be slotted into tiers
              from top to bottom. Position 1 (winner) goes to the top of Tier 1.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tierPreview.map(({ tier, wrestlers: tierWrestlers }) => (
              <div
                key={tier.id}
                className="rounded-lg border border-border/30 p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    T{tier.tier_number}
                  </span>
                  <span className="text-sm font-medium">
                    {tier.short_name || tier.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto">
                    {tierWrestlers.length}/{tier.pool_size}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tierWrestlers.map((w) => (
                    <Badge
                      key={w.id}
                      variant="secondary"
                      className="text-xs"
                    >
                      {w.name}
                      {w.pool && (
                        <span className="text-[9px] text-muted-foreground ml-1">
                          ({w.pool})
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}

            <Button
              size="lg"
              className="mt-2 w-full bg-gold text-black hover:bg-gold-dark font-semibold"
              onClick={handleAutoAssign}
              disabled={loading || !season || assigned}
            >
              {assigned
                ? "✓ Assigned Successfully"
                : loading
                  ? "Assigning..."
                  : `Assign ${sortedByFinish.length} Wrestlers to ${tierPreview.length} Tiers`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
