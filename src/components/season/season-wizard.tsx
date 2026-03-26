"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
import {
  createSeason,
  bulkAssignToTier,
  advanceSeasonStatus,
  bulkCreateMatches,
} from "@/app/actions";
import { generateRoundRobin } from "@/lib/scheduling/round-robin";
import { toast } from "sonner";
import type { PoolLabel, MatchPhase } from "@/types/database";

/* ─── Types ──────────────────────────────────────────────────────────── */

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

interface Wrestler {
  id: string;
  name: string;
  gender: string;
  overall_rating?: number | null;
}

interface TagTeam {
  id: string;
  name: string;
  wrestler_a: { gender: string } | null;
}

interface Assignment {
  id: string;
  tier_id: string;
  wrestler_id: string | null;
  tag_team_id: string | null;
  pool: string | null;
  seed: number | null;
}

interface PrevAssignment {
  wrestler_id: string | null;
  tag_team_id: string | null;
  tier_id: string;
  pool: string | null;
}

interface Props {
  season: { id: string; season_number: number; status: string } | null;
  nextSeasonNumber: number;
  tiers: Tier[];
  wrestlers: Wrestler[];
  tagTeams: TagTeam[];
  assignments: Assignment[];
  previousAssignments: PrevAssignment[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const STEPS_S1 = [
  "Create Season",
  "Men's Royal Rumble",
  "Women's Royal Rumble",
  "Tag Teams",
  "Review",
  "Start Season",
];
const STEPS_SN = [
  "Create Season",
  "Carry Forward Assignments",
  "Tag Teams",
  "Review",
  "Start Season",
];

/* ─── Component ──────────────────────────────────────────────────────── */

export function SeasonWizard({
  season: initialSeason,
  nextSeasonNumber,
  tiers,
  wrestlers,
  tagTeams,
  assignments: initialAssignments,
  previousAssignments,
}: Props) {
  const router = useRouter();
  const isSeason1 =
    (nextSeasonNumber === 1 && !initialSeason) ||
    (initialSeason?.season_number === 1);
  const steps = isSeason1 ? STEPS_S1 : STEPS_SN;

  const [step, setStep] = useState(initialSeason ? 1 : 0);
  const [seasonId, setSeasonId] = useState(initialSeason?.id ?? "");
  const [seasonNum, setSeasonNum] = useState(
    initialSeason?.season_number ?? nextSeasonNumber
  );
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState(initialAssignments);

  // Rumble state (used in Season 1 only)
  const [maleRumbleGroup, setMaleRumbleGroup] = useState<Wrestler[]>([]);
  const [malePositions, setMalePositions] = useState<Record<string, string>>({});
  const [maleAssigned, setMaleAssigned] = useState(false);
  const [femaleRumbleGroup, setFemaleRumbleGroup] = useState<Wrestler[]>([]);
  const [femalePositions, setFemalePositions] = useState<Record<string, string>>({});
  const [femaleAssigned, setFemaleAssigned] = useState(false);

  // Carry-forward state (Season 2+)
  const [carryAccepted, setCarryAccepted] = useState(false);

  // Tag team state
  const [tagAssigned, setTagAssigned] = useState(false);

  // ── Restore saved progress on mount ────────────────────────────────
  const STORAGE_KEY = `wizard-s${initialSeason?.season_number ?? nextSeasonNumber}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const s = JSON.parse(saved);
      if (s.step != null) setStep(s.step);
      if (s.maleRumbleGroup) setMaleRumbleGroup(s.maleRumbleGroup);
      if (s.malePositions) setMalePositions(s.malePositions);
      if (s.maleAssigned) setMaleAssigned(s.maleAssigned);
      if (s.femaleRumbleGroup) setFemaleRumbleGroup(s.femaleRumbleGroup);
      if (s.femalePositions) setFemalePositions(s.femalePositions);
      if (s.femaleAssigned) setFemaleAssigned(s.femaleAssigned);
      if (s.carryAccepted) setCarryAccepted(s.carryAccepted);
      if (s.tagAssigned) setTagAssigned(s.tagAssigned);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save progress on state changes ────────────────────────────
  const saveProgress = useCallback(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          step,
          maleRumbleGroup,
          malePositions,
          maleAssigned,
          femaleRumbleGroup,
          femalePositions,
          femaleAssigned,
          carryAccepted,
          tagAssigned,
        })
      );
    } catch {}
  }, [
    STORAGE_KEY, step, maleRumbleGroup, malePositions, maleAssigned,
    femaleRumbleGroup, femalePositions, femaleAssigned, carryAccepted, tagAssigned,
  ]);

  useEffect(() => {
    saveProgress();
  }, [saveProgress]);

  const tierMap = useMemo(
    () => Object.fromEntries(tiers.map((t) => [t.id, t])),
    [tiers]
  );

  const singlesTiers = (gender: string) =>
    tiers
      .filter(
        (t) =>
          t.divisions?.division_type === "singles" &&
          t.divisions?.gender === gender
      )
      .sort((a, b) => a.tier_number - b.tier_number);

  const tagTiers = tiers
    .filter((t) => t.divisions?.division_type === "tag")
    .sort((a, b) => a.tier_number - b.tier_number);

  // ── Step 0: Create Season ──────────────────────────────────────────
  async function handleCreateSeason() {
    setLoading(true);
    try {
      const data = await createSeason(nextSeasonNumber);
      setSeasonId(data.id);
      setSeasonNum(nextSeasonNumber);
      toast.success(`Season ${nextSeasonNumber} created`);
      setStep(1);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create season");
    } finally {
      setLoading(false);
    }
  }

  // ── Rumble Helpers ─────────────────────────────────────────────────

  function rumblePositionValues(positions: Record<string, string>, groupSize: number) {
    const entries = Object.entries(positions)
      .filter(([, v]) => v !== "")
      .map(([id, v]) => ({ id, pos: parseInt(v) }))
      .filter(({ pos }) => !isNaN(pos));
    const allFilled = entries.length === groupSize;
    const nums = entries.map((p) => p.pos);
    const hasDuplicates = new Set(nums).size !== nums.length;
    const hasInvalid = nums.some((p) => p < 1 || p > groupSize);
    const isValid = allFilled && !hasDuplicates && !hasInvalid;
    const sorted = isValid ? [...entries].sort((a, b) => a.pos - b.pos) : [];
    return { entries, allFilled, hasDuplicates, hasInvalid, isValid, sorted };
  }

  function computeTierPreview(
    sortedByFinish: Array<{ id: string; pos: number }>,
    gender: string
  ) {
    const relevantTiers = singlesTiers(gender);
    const preview: Array<{
      tier: Tier;
      items: Array<{ id: string; name: string; pool: PoolLabel | null }>;
    }> = [];

    let idx = 0;
    for (const tier of relevantTiers) {
      const items: Array<{ id: string; name: string; pool: PoolLabel | null }> = [];
      if (tier.has_pools) {
        let pA = 0, pB = 0;
        for (let i = 0; i < tier.pool_size && idx < sortedByFinish.length; i++) {
          const w = wrestlers.find((w) => w.id === sortedByFinish[idx].id);
          const pool: PoolLabel = pA <= pB ? "A" : "B";
          items.push({ id: sortedByFinish[idx].id, name: w?.name ?? "?", pool });
          if (pool === "A") pA++; else pB++;
          idx++;
        }
      } else {
        for (let i = 0; i < tier.pool_size && idx < sortedByFinish.length; i++) {
          const w = wrestlers.find((w) => w.id === sortedByFinish[idx].id);
          items.push({ id: sortedByFinish[idx].id, name: w?.name ?? "?", pool: null });
          idx++;
        }
      }
      if (items.length > 0) preview.push({ tier, items });
    }
    return preview;
  }

  async function handleRumbleAssign(
    gender: string,
    sorted: Array<{ id: string; pos: number }>,
    onDone: () => void
  ) {
    if (!seasonId) return;
    setLoading(true);
    try {
      const relevantTiers = singlesTiers(gender);
      const bulk: Array<{
        season_id: string;
        tier_id: string;
        wrestler_id: string;
        pool: PoolLabel | null;
        seed: number;
      }> = [];

      let idx = 0;
      for (const tier of relevantTiers) {
        if (tier.has_pools) {
          let pA = 0, pB = 0;
          for (let i = 0; i < tier.pool_size && idx < sorted.length; i++) {
            const pool: PoolLabel = pA <= pB ? "A" : "B";
            bulk.push({
              season_id: seasonId,
              tier_id: tier.id,
              wrestler_id: sorted[idx].id,
              pool,
              seed: idx + 1,
            });
            if (pool === "A") pA++; else pB++;
            idx++;
          }
        } else {
          for (let i = 0; i < tier.pool_size && idx < sorted.length; i++) {
            bulk.push({
              season_id: seasonId,
              tier_id: tier.id,
              wrestler_id: sorted[idx].id,
              pool: null,
              seed: idx + 1,
            });
            idx++;
          }
        }
      }

      if (bulk.length > 0) {
        await bulkAssignToTier(bulk);
        toast.success(`Assigned ${bulk.length} wrestlers across ${relevantTiers.length} tiers`);
        onDone();
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setLoading(false);
    }
  }

  // ── Carry Forward (Season 2+) ─────────────────────────────────────

  const carryPreview = useMemo(() => {
    if (isSeason1 || previousAssignments.length === 0) return [];
    // Group previous assignments by tier, show wrestler/tag team names
    return tiers
      .filter((t) => {
        return previousAssignments.some((a) => a.tier_id === t.id);
      })
      .map((t) => ({
        tier: t,
        participants: previousAssignments
          .filter((a) => a.tier_id === t.id)
          .map((a) => {
            const isTag = !!a.tag_team_id;
            const name = isTag
              ? tagTeams.find((tt) => tt.id === a.tag_team_id)?.name ?? "?"
              : wrestlers.find((w) => w.id === a.wrestler_id)?.name ?? "?";
            return { ...a, name, isTag };
          }),
      }))
      .filter((g) => g.participants.length > 0);
  }, [isSeason1, previousAssignments, tiers, wrestlers, tagTeams]);

  async function handleCarryForward() {
    if (!seasonId) return;
    setLoading(true);
    try {
      const bulk = previousAssignments.map((a) => ({
        season_id: seasonId,
        tier_id: a.tier_id,
        wrestler_id: a.wrestler_id ?? undefined,
        tag_team_id: a.tag_team_id ?? undefined,
        pool: (a.pool as PoolLabel) ?? undefined,
      }));
      if (bulk.length > 0) {
        await bulkAssignToTier(bulk);
        toast.success(`Carried forward ${bulk.length} assignments`);
        setCarryAccepted(true);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to carry forward");
    } finally {
      setLoading(false);
    }
  }

  // ── Tag Team Randomize ────────────────────────────────────────────

  async function handleRandomizeTags() {
    if (!seasonId) return;
    setLoading(true);
    try {
      const maleTagTiers = tagTiers.filter((t) => t.divisions?.gender === "male");
      const femaleTagTiers = tagTiers.filter((t) => t.divisions?.gender === "female");

      const maleTeams = shuffle(tagTeams.filter((t) => t.wrestler_a?.gender === "male"));
      const femaleTeams = shuffle(tagTeams.filter((t) => t.wrestler_a?.gender === "female"));

      const bulk: Array<{
        season_id: string;
        tier_id: string;
        tag_team_id: string;
        pool: PoolLabel | null;
      }> = [];

      let mIdx = 0;
      for (const tier of maleTagTiers) {
        for (let i = 0; i < tier.pool_size && mIdx < maleTeams.length; i++) {
          bulk.push({ season_id: seasonId, tier_id: tier.id, tag_team_id: maleTeams[mIdx].id, pool: null });
          mIdx++;
        }
      }
      let fIdx = 0;
      for (const tier of femaleTagTiers) {
        for (let i = 0; i < tier.pool_size && fIdx < femaleTeams.length; i++) {
          bulk.push({ season_id: seasonId, tier_id: tier.id, tag_team_id: femaleTeams[fIdx].id, pool: null });
          fIdx++;
        }
      }

      if (bulk.length > 0) {
        await bulkAssignToTier(bulk);
        toast.success(`Assigned ${bulk.length} tag teams`);
        setTagAssigned(true);
        router.refresh();
      } else {
        toast.error("No tag teams to assign");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  // ── Start Season ──────────────────────────────────────────────────

  async function handleStartSeason() {
    if (!seasonId) return;
    setLoading(true);
    try {
      // Generate round-robin schedules
      const allMatches: Array<{
        season_id: string;
        tier_id: string;
        round_number: number;
        match_phase: MatchPhase;
        pool: PoolLabel | null;
        wrestler_a_id?: string | null;
        wrestler_b_id?: string | null;
        tag_team_a_id?: string | null;
        tag_team_b_id?: string | null;
      }> = [];

      // Re-fetch assignments since they may have changed
      // We use the assignments from props + any new ones
      // For now, use router.refresh data — we need to read from the page data
      // Actually, let's compute from what we know

      for (const tier of tiers) {
        const tierAssigns = initialAssignments.filter((a) => a.tier_id === tier.id);
        if (tierAssigns.length < 2) continue;

        const isTag = tier.divisions?.division_type === "tag";

        if (tier.has_pools) {
          for (const pool of ["A", "B"] as const) {
            const poolAssigns = tierAssigns.filter((a) => a.pool === pool);
            const ids = poolAssigns.map((a) => (a.wrestler_id || a.tag_team_id)!);
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
                  ? { tag_team_a_id: match.participantA, tag_team_b_id: match.participantB }
                  : { wrestler_a_id: match.participantA, wrestler_b_id: match.participantB }),
              });
            }
          }
        } else {
          const ids = tierAssigns.map((a) => (a.wrestler_id || a.tag_team_id)!);
          if (ids.length < 2) continue;
          const schedule = generateRoundRobin(ids);
          for (const match of schedule) {
            allMatches.push({
              season_id: seasonId,
              tier_id: tier.id,
              round_number: match.round,
              match_phase: "pool_play",
              pool: null,
              ...(isTag
                ? { tag_team_a_id: match.participantA, tag_team_b_id: match.participantB }
                : { wrestler_a_id: match.participantA, wrestler_b_id: match.participantB }),
            });
          }
        }
      }

      if (allMatches.length > 0) {
        for (let i = 0; i < allMatches.length; i += 500) {
          await bulkCreateMatches(allMatches.slice(i, i + 500));
        }
      }

      await advanceSeasonStatus(seasonId, "pool_play");
      toast.success("Season started! Schedules generated.");
      router.push("/season");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start season");
    } finally {
      setLoading(false);
    }
  }

  // ── Review data ───────────────────────────────────────────────────

  const assignmentSummary = tiers
    .map((t) => {
      const tierAssigns = initialAssignments.filter((a) => a.tier_id === t.id);
      const participants = tierAssigns.map((a) => {
        if (a.wrestler_id) {
          const w = wrestlers.find((w) => w.id === a.wrestler_id);
          return { name: w?.name ?? "?", pool: a.pool, isTag: false };
        }
        const tt = tagTeams.find((tt) => tt.id === a.tag_team_id);
        return { name: tt?.name ?? "?", pool: a.pool, isTag: true };
      });
      return { tier: t, count: tierAssigns.length, participants };
    })
    .filter((s) => s.count > 0);

  const totalMatches = useMemo(() => {
    let total = 0;
    for (const tier of tiers) {
      const assigns = initialAssignments.filter((a) => a.tier_id === tier.id);
      if (assigns.length < 2) continue;
      if (tier.has_pools) {
        for (const pool of ["A", "B"]) {
          const n = assigns.filter((a) => a.pool === pool).length;
          if (n >= 2) total += (n * (n - 1)) / 2;
        }
      } else {
        const n = assigns.length;
        total += (n * (n - 1)) / 2;
      }
    }
    return total;
  }, [tiers, initialAssignments]);

  // ── Render ────────────────────────────────────────────────────────

  // Determine which logical step to show
  // For S1: 0=create, 1=men's rumble, 2=women's rumble, 3=tags, 4=review, 5=start
  // For S2+: 0=create, 1=carry forward, 2=tags, 3=review, 4=start

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Progress Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                i < step
                  ? "bg-gold/15 text-gold"
                  : i === step
                    ? "bg-foreground text-background"
                    : "bg-muted/30 text-muted-foreground/50"
              }`}
            >
              {i < step ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span className="tabular-nums">{i + 1}</span>
              )}
              <span className="hidden sm:inline whitespace-nowrap">{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-4 ${i < step ? "bg-gold/40" : "bg-border/30"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 0: Create Season ──────────────────────────────────── */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Start Season {nextSeasonNumber}</CardTitle>
            <CardDescription>
              {isSeason1
                ? "Welcome! Let's set up your first season. You'll run Royal Rumbles to seed wrestlers into tiers, assign tag teams, then start pool play."
                : `Create Season ${nextSeasonNumber} and carry forward assignments from the previous season with promotion/relegation applied.`}
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
      )}

      {/* ── Step 1 (S1): Men's Royal Rumble ────────────────────────── */}
      {isSeason1 && step === 1 && (
        <RumbleStep
          gender="male"
          label="Men's"
          wrestlers={wrestlers.filter((w) => w.gender === "male")}
          tiers={singlesTiers("male")}
          rumbleGroup={maleRumbleGroup}
          setRumbleGroup={setMaleRumbleGroup}
          positions={malePositions}
          setPositions={setMalePositions}
          assigned={maleAssigned}
          loading={loading}
          onRandomize30={() => {
            const shuffled = shuffle(wrestlers.filter((w) => w.gender === "male"));
            setMaleRumbleGroup(shuffled.slice(0, 30));
            setMalePositions({});
            setMaleAssigned(false);
          }}
          onRandomizeAll={() => {
            setMaleRumbleGroup(shuffle(wrestlers.filter((w) => w.gender === "male")));
            setMalePositions({});
            setMaleAssigned(false);
          }}
          onAssign={(sorted) =>
            handleRumbleAssign("male", sorted, () => setMaleAssigned(true))
          }
          onContinue={() => setStep(2)}
          onSkip={() => setStep(2)}
          computeTierPreview={(sorted) => computeTierPreview(sorted, "male")}
          rumblePositionValues={rumblePositionValues}
          allWrestlers={wrestlers}
        />
      )}

      {/* ── Step 2 (S1): Women's Royal Rumble ──────────────────────── */}
      {isSeason1 && step === 2 && (
        <RumbleStep
          gender="female"
          label="Women's"
          wrestlers={wrestlers.filter((w) => w.gender === "female")}
          tiers={singlesTiers("female")}
          rumbleGroup={femaleRumbleGroup}
          setRumbleGroup={setFemaleRumbleGroup}
          positions={femalePositions}
          setPositions={setFemalePositions}
          assigned={femaleAssigned}
          loading={loading}
          onRandomize30={() => {
            const shuffled = shuffle(wrestlers.filter((w) => w.gender === "female"));
            setFemaleRumbleGroup(shuffled.slice(0, 30));
            setFemalePositions({});
            setFemaleAssigned(false);
          }}
          onRandomizeAll={() => {
            setFemaleRumbleGroup(shuffle(wrestlers.filter((w) => w.gender === "female")));
            setFemalePositions({});
            setFemaleAssigned(false);
          }}
          onAssign={(sorted) =>
            handleRumbleAssign("female", sorted, () => setFemaleAssigned(true))
          }
          onContinue={() => setStep(3)}
          onSkip={() => setStep(3)}
          computeTierPreview={(sorted) => computeTierPreview(sorted, "female")}
          rumblePositionValues={rumblePositionValues}
          allWrestlers={wrestlers}
        />
      )}

      {/* ── Step 1 (S2+): Carry Forward ────────────────────────────── */}
      {!isSeason1 && step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Carry Forward from Season {seasonNum - 1}</CardTitle>
            <CardDescription>
              Based on last season&apos;s results (including promotions and relegations),
              here are the proposed tier assignments for Season {seasonNum}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {carryPreview.length > 0 ? (
              <>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {carryPreview.map(({ tier, participants }) => (
                    <div key={tier.id} className="rounded-lg border border-border/30 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          T{tier.tier_number}
                        </span>
                        <span className="text-sm font-medium">
                          {tier.short_name || tier.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 ml-auto">
                          {participants.length}/{tier.pool_size}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {participants.map((p) => (
                          <Badge key={p.wrestler_id || p.tag_team_id} variant="secondary" className="text-xs">
                            {p.name}
                            {p.pool && <span className="text-[9px] text-muted-foreground ml-1">({p.pool})</span>}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCarryForward}
                    disabled={loading || carryAccepted}
                    className="bg-gold text-black hover:bg-gold-dark font-semibold"
                  >
                    {carryAccepted ? "✓ Accepted" : loading ? "Assigning..." : "Accept & Continue"}
                  </Button>
                  <Button variant="outline" onClick={() => setStep(2)} disabled={loading}>
                    Skip (assign manually)
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No previous assignments found. You can assign manually in the next steps.
                <div className="mt-3">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tag Teams Step ─────────────────────────────────────────── */}
      {((isSeason1 && step === 3) || (!isSeason1 && step === 2)) && (
        <Card>
          <CardHeader>
            <CardTitle>Tag Team Assignment</CardTitle>
            <CardDescription>
              Randomly distribute tag teams across tag tiers, or skip to assign manually later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {tagTeams.filter((t) => t.wrestler_a?.gender === "male").length}
              </span>{" "}
              male tag teams ·{" "}
              <span className="font-medium text-foreground">
                {tagTeams.filter((t) => t.wrestler_a?.gender === "female").length}
              </span>{" "}
              female tag teams ·{" "}
              <span className="font-medium text-foreground">
                {tagTiers.length}
              </span>{" "}
              tag tiers
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRandomizeTags}
                disabled={loading || tagAssigned}
                className="bg-gold text-black hover:bg-gold-dark font-semibold"
              >
                {tagAssigned
                  ? "✓ Assigned"
                  : loading
                    ? "Assigning..."
                    : "🎲 Randomize Tag Teams"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep(isSeason1 ? 4 : 3)}
                disabled={loading}
              >
                {tagAssigned ? "Continue" : "Skip"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Review Step ────────────────────────────────────────────── */}
      {((isSeason1 && step === 4) || (!isSeason1 && step === 3)) && (
        <Card>
          <CardHeader>
            <CardTitle>Review Assignments</CardTitle>
            <CardDescription>
              Verify all tier assignments before starting the season.
              You can go back to adjust if needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignmentSummary.length > 0 ? (
              <div className="space-y-3">
                {assignmentSummary.map(({ tier, count, participants }) => (
                  <div
                    key={tier.id}
                    className={`rounded-lg border p-3 ${
                      count >= tier.pool_size
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : count < 2
                          ? "border-red-500/20 bg-red-500/5"
                          : "border-border/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">
                        <span className="text-muted-foreground font-mono text-xs mr-1.5">
                          T{tier.tier_number}
                        </span>
                        <span className="font-medium">
                          {tier.short_name || tier.name}
                        </span>
                      </span>
                      <span
                        className={`text-xs font-mono ${
                          count >= tier.pool_size
                            ? "text-emerald-400"
                            : count < 2
                              ? "text-red-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {count}/{tier.pool_size}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {participants.map((p, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {p.name}
                          {p.pool && (
                            <span className="text-muted-foreground ml-0.5">
                              ({p.pool})
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No assignments yet. Go back to assign wrestlers and tag teams.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(isSeason1 ? 3 : 2)}
              >
                ← Back
              </Button>
              <Button
                onClick={() => setStep(isSeason1 ? 5 : 4)}
                disabled={assignmentSummary.length === 0}
                className="bg-gold text-black hover:bg-gold-dark font-semibold"
              >
                Looks Good →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Start Season Step ──────────────────────────────────────── */}
      {((isSeason1 && step === 5) || (!isSeason1 && step === 4)) && (
        <Card className="border-gold/20 bg-gold/5">
          <CardHeader>
            <CardTitle>Start Season {seasonNum}</CardTitle>
            <CardDescription>
              This will generate round-robin schedules for all assigned tiers
              and advance the season to Pool Play. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tiers: </span>
                <span className="font-bold">{assignmentSummary.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Matches: </span>
                <span className="font-bold">~{totalMatches}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(isSeason1 ? 4 : 3)}
              >
                ← Back
              </Button>
              <Button
                size="lg"
                onClick={handleStartSeason}
                disabled={loading}
                className="bg-gold text-black hover:bg-gold-dark font-bold"
              >
                {loading ? "Generating schedules..." : `🏁 Start Season ${seasonNum}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Rumble Step Sub-component ───────────────────────────────────────── */

function RumbleStep({
  gender,
  label,
  wrestlers,
  tiers,
  rumbleGroup,
  setRumbleGroup,
  positions,
  setPositions,
  assigned,
  loading,
  onRandomize30,
  onRandomizeAll,
  onAssign,
  onContinue,
  onSkip,
  computeTierPreview,
  rumblePositionValues,
  allWrestlers,
}: {
  gender: string;
  label: string;
  wrestlers: Wrestler[];
  tiers: Tier[];
  rumbleGroup: Wrestler[];
  setRumbleGroup: (g: Wrestler[]) => void;
  positions: Record<string, string>;
  setPositions: (p: Record<string, string>) => void;
  assigned: boolean;
  loading: boolean;
  onRandomize30: () => void;
  onRandomizeAll: () => void;
  onAssign: (sorted: Array<{ id: string; pos: number }>) => void;
  onContinue: () => void;
  onSkip: () => void;
  computeTierPreview: (sorted: Array<{ id: string; pos: number }>) => Array<{
    tier: Tier;
    items: Array<{ id: string; name: string; pool: PoolLabel | null }>;
  }>;
  rumblePositionValues: (
    p: Record<string, string>,
    n: number
  ) => {
    entries: Array<{ id: string; pos: number }>;
    allFilled: boolean;
    hasDuplicates: boolean;
    hasInvalid: boolean;
    isValid: boolean;
    sorted: Array<{ id: string; pos: number }>;
  };
  allWrestlers: Wrestler[];
}) {
  const totalSlots = tiers.reduce((sum, t) => sum + t.pool_size, 0);
  const pv = rumblePositionValues(positions, rumbleGroup.length);
  const preview = pv.isValid ? computeTierPreview(pv.sorted) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{label} Royal Rumble</CardTitle>
          <CardDescription>
            {wrestlers.length} {label.toLowerCase()} wrestlers available · {tiers.length} tiers · {totalSlots} total slots.
            Randomize the group, run the Rumble in-game, then enter finishing positions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Randomize */}
          {!assigned && (
            <div className="flex gap-2">
              <Button onClick={onRandomize30} className="bg-gold text-black hover:bg-gold-dark font-semibold">
                Randomize 30
              </Button>
              {wrestlers.length > 30 && (
                <Button variant="outline" onClick={onRandomizeAll}>
                  Randomize All ({wrestlers.length})
                </Button>
              )}
              {rumbleGroup.length > 0 && (
                <Button variant="ghost" onClick={() => { setRumbleGroup([]); setPositions({}); }}>
                  Clear
                </Button>
              )}
            </div>
          )}

          {/* Position Entry */}
          {rumbleGroup.length > 0 && !assigned && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-[60vh] overflow-y-auto">
                {rumbleGroup.map((w) => {
                  const pos = positions[w.id] ?? "";
                  const posNum = parseInt(pos);
                  const isDup =
                    pos !== "" &&
                    !isNaN(posNum) &&
                    pv.entries.filter((p) => p.pos === posNum).length > 1;
                  const isOOR =
                    pos !== "" &&
                    !isNaN(posNum) &&
                    (posNum < 1 || posNum > rumbleGroup.length);
                  return (
                    <div
                      key={w.id}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
                        isDup || isOOR
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
                          setPositions({ ...positions, [w.id]: e.target.value })
                        }
                        placeholder="#"
                        className="w-14 h-7 text-center text-xs font-mono tabular-nums bg-background/50"
                      />
                      <span className="text-xs font-medium truncate flex-1">{w.name}</span>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {pv.entries.length}/{rumbleGroup.length} filled
                {pv.isValid && " ✓"}
                {pv.hasDuplicates && " · ⚠ Duplicates"}
                {pv.hasInvalid && ` · ⚠ Must be 1–${rumbleGroup.length}`}
              </div>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !assigned && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tier Preview
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {preview.map(({ tier, items }) => (
                  <div key={tier.id} className="rounded-md border border-border/30 p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-muted-foreground">T{tier.tier_number}</span>
                      <span className="text-xs font-medium">{tier.short_name || tier.name}</span>
                      <span className="text-[10px] text-muted-foreground/50 ml-auto">{items.length}/{tier.pool_size}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {items.map((w) => (
                        <Badge key={w.id} variant="secondary" className="text-[10px]">
                          {w.name}{w.pool && ` (${w.pool})`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => onAssign(pv.sorted)}
                disabled={loading}
                className="bg-gold text-black hover:bg-gold-dark font-semibold"
              >
                {loading ? "Assigning..." : `Assign ${pv.sorted.length} Wrestlers`}
              </Button>
            </div>
          )}

          {/* Assigned confirmation */}
          {assigned && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm text-emerald-400 font-medium">
                ✓ {label} wrestlers assigned to tiers
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onSkip}>
          {assigned ? "Continue →" : "Skip"}
        </Button>
        {assigned && (
          <Button onClick={onContinue} className="bg-gold text-black hover:bg-gold-dark font-semibold">
            Continue →
          </Button>
        )}
      </div>
    </div>
  );
}
