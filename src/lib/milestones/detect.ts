/**
 * Detect fun milestones after recording a match result.
 * Returns an array of milestone messages to display as toasts.
 */

interface MatchData {
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  matchTimeSeconds: number;
  tierName: string;
  pool: string | null;
}

interface SeasonContext {
  // All played matches in the season (including the one just recorded)
  allMatches: Array<{
    winner_id: string;
    loser_id: string;
    match_time_seconds: number;
    tier_id: string;
    pool: string | null;
    played_at: string | null;
  }>;
  // Total and played match counts for the tier
  tierTotalMatches: number;
  tierPlayedMatches: number;
  // Pool-specific counts
  poolTotalMatches: number;
  poolPlayedMatches: number;
}

export interface Milestone {
  emoji: string;
  message: string;
  type: "info" | "success" | "warning";
}

export function detectMilestones(
  match: MatchData,
  context: SeasonContext
): Milestone[] {
  const milestones: Milestone[] = [];

  // ── Win Streak ────────────────────────────────────────────────
  const winnerMatches = context.allMatches
    .filter((m) => m.winner_id === match.winnerId || m.loser_id === match.winnerId)
    .filter((m) => m.played_at)
    .sort((a, b) => new Date(b.played_at!).getTime() - new Date(a.played_at!).getTime());

  let streak = 0;
  for (const m of winnerMatches) {
    if (m.winner_id === match.winnerId) {
      streak++;
    } else {
      break;
    }
  }

  if (streak === 3) {
    milestones.push({
      emoji: "🔥",
      message: `${match.winnerName} is on a 3-match win streak!`,
      type: "info",
    });
  } else if (streak === 5) {
    milestones.push({
      emoji: "🔥🔥",
      message: `${match.winnerName} is DOMINANT — 5-match win streak!`,
      type: "success",
    });
  } else if (streak >= 7) {
    milestones.push({
      emoji: "🔥🔥🔥",
      message: `${match.winnerName} is UNSTOPPABLE — ${streak}-match win streak!`,
      type: "success",
    });
  }

  // ── Fastest Match ─────────────────────────────────────────────
  if (match.matchTimeSeconds > 0) {
    const allTimes = context.allMatches
      .filter((m) => m.match_time_seconds > 0 && m.played_at)
      .map((m) => m.match_time_seconds);

    if (allTimes.length > 1) {
      const minTime = Math.min(...allTimes);
      if (match.matchTimeSeconds <= minTime) {
        const mins = Math.floor(match.matchTimeSeconds / 60);
        const secs = match.matchTimeSeconds % 60;
        milestones.push({
          emoji: "⚡",
          message: `Fastest match this season! ${mins}:${secs.toString().padStart(2, "0")} by ${match.winnerName}`,
          type: "info",
        });
      }
    }
  }

  // ── Pool Play Complete ────────────────────────────────────────
  if (context.poolPlayedMatches === context.poolTotalMatches && context.poolTotalMatches > 0) {
    milestones.push({
      emoji: "✅",
      message: `Pool ${match.pool || ""} play complete for ${match.tierName}!`,
      type: "success",
    });
  }

  // ── Tier Pool Play Complete ───────────────────────────────────
  if (context.tierPlayedMatches === context.tierTotalMatches && context.tierTotalMatches > 0) {
    milestones.push({
      emoji: "🏆",
      message: `All pool play matches complete for ${match.tierName}! Ready for playoffs.`,
      type: "success",
    });
  }

  // ── Undefeated Season ─────────────────────────────────────────
  const winnerLosses = context.allMatches.filter(
    (m) => m.loser_id === match.winnerId && m.played_at
  ).length;
  const winnerWins = context.allMatches.filter(
    (m) => m.winner_id === match.winnerId && m.played_at
  ).length;

  if (winnerLosses === 0 && winnerWins >= 4) {
    milestones.push({
      emoji: "💎",
      message: `${match.winnerName} is UNDEFEATED (${winnerWins}-0)!`,
      type: "success",
    });
  }

  // ── Upset Alert (winless beats undefeated) ────────────────────
  const loserWins = context.allMatches.filter(
    (m) => m.winner_id === match.loserId && m.played_at
  ).length;
  const loserLosses = context.allMatches.filter(
    (m) => m.loser_id === match.loserId && m.played_at
  ).length;

  // The match just played already counts, so check pre-match state
  if (winnerWins <= 1 && loserWins >= 3 && loserLosses <= 1) {
    milestones.push({
      emoji: "😱",
      message: `UPSET! ${match.winnerName} takes down ${match.loserName}!`,
      type: "warning",
    });
  }

  return milestones;
}
