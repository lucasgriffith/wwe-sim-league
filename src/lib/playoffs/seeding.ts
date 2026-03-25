import type { StandingsRow } from "@/lib/standings/compute-standings";

export interface PlayoffSeed {
  seed: number;
  participantId: string;
  name: string;
  pool: string | null;
  winPct: number;
  poolRank: number;
  qualificationType: "pool_top2" | "wild_card";
}

/**
 * Compute 6 playoff seeds from two pool standings.
 * - Top 2 from each pool auto-qualify (4 spots)
 * - Best 2 remaining across both pools are wild cards (2 spots)
 * - Seeds 1-6 ordered by overall record (win%, then tiebreakers)
 */
export function computePlayoffSeeds(
  poolA: StandingsRow[],
  poolB: StandingsRow[]
): PlayoffSeed[] {
  const qualifiers: (StandingsRow & {
    pool: string;
    poolRank: number;
    qualificationType: "pool_top2" | "wild_card";
  })[] = [];

  // Top 2 from each pool
  for (const [pool, standings] of [
    ["A", poolA],
    ["B", poolB],
  ] as const) {
    for (let i = 0; i < Math.min(2, standings.length); i++) {
      qualifiers.push({
        ...standings[i],
        pool,
        poolRank: i + 1,
        qualificationType: "pool_top2",
      });
    }
  }

  // Wild cards: remaining wrestlers ranked by win%, take best 2
  const qualifiedIds = new Set(qualifiers.map((q) => q.participantId));
  const remaining = [
    ...poolA
      .filter((r) => !qualifiedIds.has(r.participantId))
      .map((r) => ({ ...r, pool: "A" as const })),
    ...poolB
      .filter((r) => !qualifiedIds.has(r.participantId))
      .map((r) => ({ ...r, pool: "B" as const })),
  ].sort((a, b) => {
    if (a.winPct !== b.winPct) return b.winPct - a.winPct;
    if (a.totalMatchTime !== b.totalMatchTime)
      return a.totalMatchTime - b.totalMatchTime;
    return 0;
  });

  for (let i = 0; i < Math.min(2, remaining.length); i++) {
    qualifiers.push({
      ...remaining[i],
      poolRank: remaining[i].rank,
      qualificationType: "wild_card",
    });
  }

  // Sort all 6 by overall record for seeding
  qualifiers.sort((a, b) => {
    if (a.winPct !== b.winPct) return b.winPct - a.winPct;
    if (a.totalMatchTime !== b.totalMatchTime)
      return a.totalMatchTime - b.totalMatchTime;
    return 0;
  });

  return qualifiers.map((q, i) => ({
    seed: i + 1,
    participantId: q.participantId,
    name: q.name,
    pool: q.pool,
    winPct: q.winPct,
    poolRank: q.poolRank,
    qualificationType: q.qualificationType,
  }));
}

/**
 * For tag tiers (no pools): top 2 go straight to the final.
 */
export function computeTagPlayoffSeeds(
  standings: StandingsRow[]
): PlayoffSeed[] {
  return standings.slice(0, 2).map((s, i) => ({
    seed: i + 1,
    participantId: s.participantId,
    name: s.name,
    pool: null,
    winPct: s.winPct,
    poolRank: s.rank,
    qualificationType: "pool_top2" as const,
  }));
}
