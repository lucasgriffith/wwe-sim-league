export interface FinalStanding {
  participantId: string;
  name: string;
  finalRank: number; // 1 = champion, 2 = finalist, etc.
}

export interface TierInfo {
  tierId: string;
  tierNumber: number;
  divisionId: string;
}

export interface Movement {
  participantId: string;
  name: string;
  movementType:
    | "auto_promote"
    | "auto_relegate"
    | "playoff_promote"
    | "playoff_relegate"
    | "playoff_survive";
  fromTierId: string;
  toTierId: string | null; // null if staying (playoff_survive)
  needsMatch: boolean;
  opponentId?: string;
  opponentName?: string;
}

/**
 * Determine relegation/promotion movements for a pair of adjacent tiers.
 *
 * Given final standings for two adjacent tiers:
 * - Bottom 2 of higher tier: auto-relegate to lower tier
 * - Top 2 of lower tier (except if it's the top tier): auto-promote
 * - 3rd from bottom (higher) vs 3rd from top (lower): Steel Cage playoff
 * - 4th from bottom (higher) vs 4th from top (lower): Steel Cage playoff
 *
 * @param higherTier - The higher-ranked tier (lower tier_number)
 * @param lowerTier - The lower-ranked tier (higher tier_number)
 * @param higherStandings - Final standings for the higher tier (sorted by finalRank)
 * @param lowerStandings - Final standings for the lower tier (sorted by finalRank)
 */
export function determineMovements(
  higherTier: TierInfo,
  lowerTier: TierInfo,
  higherStandings: FinalStanding[],
  lowerStandings: FinalStanding[]
): Movement[] {
  const movements: Movement[] = [];
  const hLen = higherStandings.length;
  const lLen = lowerStandings.length;

  // Auto-relegate: bottom 2 of higher tier go down
  for (let i = hLen - 1; i >= Math.max(0, hLen - 2); i--) {
    const s = higherStandings[i];
    movements.push({
      participantId: s.participantId,
      name: s.name,
      movementType: "auto_relegate",
      fromTierId: higherTier.tierId,
      toTierId: lowerTier.tierId,
      needsMatch: false,
    });
  }

  // Auto-promote: top 2 of lower tier go up
  for (let i = 0; i < Math.min(2, lLen); i++) {
    const s = lowerStandings[i];
    movements.push({
      participantId: s.participantId,
      name: s.name,
      movementType: "auto_promote",
      fromTierId: lowerTier.tierId,
      toTierId: higherTier.tierId,
      needsMatch: false,
    });
  }

  // Relegation playoffs: 3rd from bottom vs 3rd from top, 4th vs 4th
  const playoffPairs: [number, number][] = [
    [hLen - 3, 2], // 3rd from bottom vs 3rd in lower
    [hLen - 4, 3], // 4th from bottom vs 4th in lower
  ];

  for (const [higherIdx, lowerIdx] of playoffPairs) {
    if (higherIdx >= 0 && higherIdx < hLen && lowerIdx < lLen) {
      const higher = higherStandings[higherIdx];
      const lower = lowerStandings[lowerIdx];

      // The higher tier wrestler is defending their spot
      movements.push({
        participantId: higher.participantId,
        name: higher.name,
        movementType: "playoff_survive", // Will be updated after match
        fromTierId: higherTier.tierId,
        toTierId: null,
        needsMatch: true,
        opponentId: lower.participantId,
        opponentName: lower.name,
      });
    }
  }

  return movements;
}

/**
 * Process the result of a relegation Steel Cage match.
 * Winner stays in / promotes to the higher tier.
 * Loser relegates to / stays in the lower tier.
 */
export function processRelegationMatchResult(
  winnerId: string,
  loserId: string,
  higherTierId: string,
  lowerTierId: string,
  participants: Map<string, { name: string; currentTierId: string }>
): Movement[] {
  const winner = participants.get(winnerId);
  const loser = participants.get(loserId);
  if (!winner || !loser) return [];

  const movements: Movement[] = [];

  // Winner goes to / stays in higher tier
  if (winner.currentTierId === lowerTierId) {
    movements.push({
      participantId: winnerId,
      name: winner.name,
      movementType: "playoff_promote",
      fromTierId: lowerTierId,
      toTierId: higherTierId,
      needsMatch: false,
    });
  } else {
    movements.push({
      participantId: winnerId,
      name: winner.name,
      movementType: "playoff_survive",
      fromTierId: higherTierId,
      toTierId: null,
      needsMatch: false,
    });
  }

  // Loser goes to / stays in lower tier
  if (loser.currentTierId === higherTierId) {
    movements.push({
      participantId: loserId,
      name: loser.name,
      movementType: "playoff_relegate",
      fromTierId: higherTierId,
      toTierId: lowerTierId,
      needsMatch: false,
    });
  }

  return movements;
}
