/**
 * Clinch/elimination status for pool standings — the single implementation
 * used by both the standings page and tier pages.
 *
 * Wins-based worst/best-case math (each participant plays `totalRounds`
 * matches in a round robin):
 * - Clinched (rows currently top 2): even losing out, no one outside the
 *   top 2 can finish with more wins.
 * - Eliminated (rows currently 3rd+): even winning out, can't reach the
 *   current 2nd-place win total.
 * Ties are treated as catchable, so "clinched" is conservative.
 */

export type ClinchStatus =
  | "clinched" // Guaranteed top 2 in pool
  | "contender" // Still alive for a top-2 finish
  | "eliminated" // Cannot reach top 2
  | null;

export function computeClinchStatus(
  sortedStandings: Array<{
    participantId: string;
    wins: number;
    losses: number;
  }>,
  totalRounds: number // Matches each participant plays (pool size - 1)
): Map<string, ClinchStatus> {
  const result = new Map<string, ClinchStatus>();
  const count = sortedStandings.length;
  if (count < 3 || totalRounds <= 0) return result;

  let maxRivalBest = 0;
  for (let j = 2; j < count; j++) {
    const rival = sortedStandings[j];
    const remaining = Math.max(0, totalRounds - rival.wins - rival.losses);
    maxRivalBest = Math.max(maxRivalBest, rival.wins + remaining);
  }

  for (let idx = 0; idx < count; idx++) {
    const p = sortedStandings[idx];
    if (idx < 2) {
      result.set(
        p.participantId,
        p.wins > maxRivalBest ? "clinched" : "contender"
      );
    } else {
      const remaining = Math.max(0, totalRounds - p.wins - p.losses);
      const bestCase = p.wins + remaining;
      result.set(
        p.participantId,
        bestCase < sortedStandings[1].wins ? "eliminated" : "contender"
      );
    }
  }

  return result;
}
