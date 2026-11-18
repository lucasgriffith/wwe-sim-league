export interface MatchResult {
  id: string;
  wrestlerAId: string;
  wrestlerBId: string;
  winnerId: string;
  matchTimeSeconds: number;
}

export interface StandingsRow {
  participantId: string;
  name: string;
  wins: number;
  losses: number;
  winPct: number;
  matchesPlayed: number;
  totalMatchTime: number;
  avgMatchTime: number;
  /** Average duration of matches this participant WON (0 if no wins) */
  avgWinTime: number;
  rank: number;
}

/**
 * THE canonical standings order, used by every surface (standings page, tier
 * page, playoff seeding). Official tiebreak order:
 *
 * 1. Win percentage (descending)
 * 2. Games back (ascending) — i.e. win-loss differential. Only separates
 *    rows while match counts differ: 3-0 sits above 1-0, and 0-1 above 0-3
 * 3. Head-to-head record among the tied group (mini-league: only matches
 *    between tied participants count) — transitive by construction, so a
 *    circular head-to-head can't make the order depend on input order
 * 4. Average time of WINS (ascending — quicker wins = more dominant)
 * 5. Deterministic hash of participant id (stable across renders)
 */
export function computeStandings(
  participants: { id: string; name: string }[],
  matches: MatchResult[]
): StandingsRow[] {
  const stats = new Map<
    string,
    { name: string; wins: number; losses: number; totalTime: number; winTime: number }
  >();

  for (const p of participants) {
    stats.set(p.id, { name: p.name, wins: 0, losses: 0, totalTime: 0, winTime: 0 });
  }

  for (const m of matches) {
    const aStats = stats.get(m.wrestlerAId);
    const bStats = stats.get(m.wrestlerBId);

    if (aStats) {
      if (m.winnerId === m.wrestlerAId) {
        aStats.wins++;
        aStats.winTime += m.matchTimeSeconds;
      } else aStats.losses++;
      aStats.totalTime += m.matchTimeSeconds;
    }
    if (bStats) {
      if (m.winnerId === m.wrestlerBId) {
        bStats.wins++;
        bStats.winTime += m.matchTimeSeconds;
      } else bStats.losses++;
      bStats.totalTime += m.matchTimeSeconds;
    }
  }

  const rows: StandingsRow[] = Array.from(stats.entries()).map(([id, s]) => {
    const played = s.wins + s.losses;
    return {
      participantId: id,
      name: s.name,
      wins: s.wins,
      losses: s.losses,
      winPct: played > 0 ? s.wins / played : 0,
      matchesPlayed: played,
      totalMatchTime: s.totalTime,
      avgMatchTime: played > 0 ? Math.round(s.totalTime / played) : 0,
      avgWinTime: s.wins > 0 ? Math.round(s.winTime / s.wins) : 0,
      rank: 0,
    };
  });

  // Sort by win% then games back (= win-loss differential) into tied groups,
  // then break each group as a unit
  const diff = (r: StandingsRow) => r.wins - r.losses;
  rows.sort((a, b) => b.winPct - a.winPct || diff(b) - diff(a));

  const ordered: StandingsRow[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (
      j < rows.length &&
      rows[j].winPct === rows[i].winPct &&
      diff(rows[j]) === diff(rows[i])
    ) {
      j++;
    }
    ordered.push(...orderTiedGroup(rows.slice(i, j), matches));
    i = j;
  }

  ordered.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  return ordered;
}

/** Break a tied group: mini-league record → avg time of wins → hash. */
function orderTiedGroup(
  group: StandingsRow[],
  matches: MatchResult[]
): StandingsRow[] {
  if (group.length === 1) return group;

  const ids = new Set(group.map((r) => r.participantId));
  const miniWins = new Map<string, number>();
  const miniPlayed = new Map<string, number>();
  for (const id of ids) {
    miniWins.set(id, 0);
    miniPlayed.set(id, 0);
  }

  for (const m of matches) {
    if (!ids.has(m.wrestlerAId) || !ids.has(m.wrestlerBId)) continue;
    miniPlayed.set(m.wrestlerAId, miniPlayed.get(m.wrestlerAId)! + 1);
    miniPlayed.set(m.wrestlerBId, miniPlayed.get(m.wrestlerBId)! + 1);
    if (ids.has(m.winnerId)) {
      miniWins.set(m.winnerId, (miniWins.get(m.winnerId) ?? 0) + 1);
    }
  }

  const miniPct = (id: string) => {
    const played = miniPlayed.get(id) ?? 0;
    return played > 0 ? (miniWins.get(id) ?? 0) / played : 0;
  };

  return [...group].sort((a, b) => {
    const aMini = miniPct(a.participantId);
    const bMini = miniPct(b.participantId);
    if (aMini !== bMini) return bMini - aMini;
    if (a.avgWinTime !== b.avgWinTime) {
      // Participants with no wins (0) sort below anyone with a win time
      if (a.avgWinTime === 0) return 1;
      if (b.avgWinTime === 0) return -1;
      return a.avgWinTime - b.avgWinTime;
    }
    return simpleHash(a.participantId) - simpleHash(b.participantId);
  });
}

/** Simple numeric hash for deterministic tiebreaking */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
