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
  totalMatchTime: number;
  rank: number;
}

/**
 * Compute standings from match results with tiebreakers:
 * 1. Win percentage (descending)
 * 2. Head-to-head record
 * 3. Faster total match time (ascending — less time = more dominant)
 * 4. Deterministic random (hash-based)
 */
export function computeStandings(
  participants: { id: string; name: string }[],
  matches: MatchResult[]
): StandingsRow[] {
  // Build stat map
  const stats = new Map<
    string,
    { name: string; wins: number; losses: number; totalTime: number }
  >();

  for (const p of participants) {
    stats.set(p.id, { name: p.name, wins: 0, losses: 0, totalTime: 0 });
  }

  for (const m of matches) {
    const aStats = stats.get(m.wrestlerAId);
    const bStats = stats.get(m.wrestlerBId);

    if (aStats) {
      if (m.winnerId === m.wrestlerAId) aStats.wins++;
      else aStats.losses++;
      aStats.totalTime += m.matchTimeSeconds;
    }
    if (bStats) {
      if (m.winnerId === m.wrestlerBId) bStats.wins++;
      else bStats.losses++;
      bStats.totalTime += m.matchTimeSeconds;
    }
  }

  // Build H2H lookup
  const h2h = new Map<string, Map<string, number>>();
  for (const m of matches) {
    if (!h2h.has(m.wrestlerAId)) h2h.set(m.wrestlerAId, new Map());
    if (!h2h.has(m.wrestlerBId)) h2h.set(m.wrestlerBId, new Map());

    if (m.winnerId === m.wrestlerAId) {
      h2h
        .get(m.wrestlerAId)!
        .set(
          m.wrestlerBId,
          (h2h.get(m.wrestlerAId)!.get(m.wrestlerBId) ?? 0) + 1
        );
    } else {
      h2h
        .get(m.wrestlerBId)!
        .set(
          m.wrestlerAId,
          (h2h.get(m.wrestlerBId)!.get(m.wrestlerAId) ?? 0) + 1
        );
    }
  }

  // Convert to array and sort
  const rows: StandingsRow[] = Array.from(stats.entries()).map(
    ([id, s]) => ({
      participantId: id,
      name: s.name,
      wins: s.wins,
      losses: s.losses,
      winPct:
        s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0,
      totalMatchTime: s.totalTime,
      rank: 0,
    })
  );

  rows.sort((a, b) => {
    // 1. Win percentage
    if (a.winPct !== b.winPct) return b.winPct - a.winPct;

    // 2. Head-to-head
    const aWinsVsB = h2h.get(a.participantId)?.get(b.participantId) ?? 0;
    const bWinsVsA = h2h.get(b.participantId)?.get(a.participantId) ?? 0;
    if (aWinsVsB !== bWinsVsA) return bWinsVsA - aWinsVsB; // More H2H wins = higher rank

    // 3. Faster total match time
    if (a.totalMatchTime !== b.totalMatchTime)
      return a.totalMatchTime - b.totalMatchTime;

    // 4. Deterministic tie-break by ID hash
    return simpleHash(a.participantId) - simpleHash(b.participantId);
  });

  // Assign ranks
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });

  return rows;
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
