/**
 * Compute clinch/elimination status for standings.
 *
 * Clinched: Even if they lose all remaining matches, they'd still be in the top 2.
 * Wild Card Contender: Could qualify as a wild card.
 * Eliminated: Even if they win all remaining matches, they can't reach top 2.
 *
 * This is a simplified model — it doesn't account for complex H2H tiebreakers,
 * but gives good directional indicators for the user.
 */

export type ClinchStatus =
  | "clinched" // Guaranteed top 2 in pool
  | "contender" // Still alive for playoffs
  | "eliminated" // Cannot reach top 2
  | null; // Not enough data yet

export function computeClinchStatus(
  standings: Array<{
    participantId: string;
    wins: number;
    losses: number;
    winPct: number;
  }>,
  totalPoolMatches: number, // Total matches each participant will play in the pool
  playedPoolMatches: number // How many pool play matches have been played total
): Map<string, ClinchStatus> {
  const result = new Map<string, ClinchStatus>();

  if (standings.length < 3 || totalPoolMatches === 0) {
    // Can't clinch/eliminate with 2 or fewer participants
    return result;
  }

  const matchesPerParticipant = totalPoolMatches; // In a round robin, each plays N-1 matches
  const minMatchesForCalc = Math.ceil(matchesPerParticipant * 0.4);

  for (const player of standings) {
    const matchesPlayed = player.wins + player.losses;

    if (matchesPlayed < minMatchesForCalc) {
      result.set(player.participantId, null);
      continue;
    }

    const remainingMatches = matchesPerParticipant - matchesPlayed;

    // Best case: win all remaining
    const bestWins = player.wins + remainingMatches;
    const bestPct = bestWins / matchesPerParticipant;

    // Worst case: lose all remaining
    const worstWins = player.wins;
    const worstPct = worstWins / matchesPerParticipant;

    // Check against the #2 position threshold
    // The 2nd place finisher needs at most their current wins
    const sorted = [...standings].sort((a, b) => b.winPct - a.winPct);
    const secondPlaceIdx = Math.min(1, sorted.length - 1);
    const thirdPlaceIdx = Math.min(2, sorted.length - 1);

    const currentRank = sorted.findIndex(
      (s) => s.participantId === player.participantId
    );

    // Clinched: even in worst case, no one below can catch up
    if (currentRank <= 1) {
      // Check if 3rd place can catch up even winning all remaining
      const thirdPlace = sorted[thirdPlaceIdx];
      if (thirdPlace) {
        const thirdBestWins =
          thirdPlace.wins +
          (matchesPerParticipant - thirdPlace.wins - thirdPlace.losses);
        const thirdBestPct = thirdBestWins / matchesPerParticipant;
        if (worstPct > thirdBestPct) {
          result.set(player.participantId, "clinched");
          continue;
        }
      }
    }

    // Eliminated: even in best case, can't reach 2nd place
    if (currentRank >= 2) {
      const secondPlace = sorted[secondPlaceIdx];
      if (secondPlace && secondPlace.participantId !== player.participantId) {
        const secondWorstWins = secondPlace.wins; // if they lose everything remaining
        const secondWorstPct = secondWorstWins / matchesPerParticipant;
        if (bestPct < secondWorstPct) {
          result.set(player.participantId, "eliminated");
          continue;
        }
      }
    }

    result.set(player.participantId, "contender");
  }

  return result;
}
