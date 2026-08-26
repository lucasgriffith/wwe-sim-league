/**
 * All-time league record book, computed from every played match across
 * every season.
 */

export interface RecordParticipant {
  name: string;
  href: string | null;
  imageUrl: string | null;
  isTag: boolean;
}

interface RecordMatchRow {
  id: string;
  season_id: string;
  wrestler_a_id: string | null;
  wrestler_b_id: string | null;
  tag_team_a_id: string | null;
  tag_team_b_id: string | null;
  winner_wrestler_id: string | null;
  winner_tag_team_id: string | null;
  match_phase: string;
  match_time_seconds: number | null;
  stipulation: string | null;
  played_at: string | null;
  tiers?: { name: string; short_name: string | null } | null;
  seasons?: { season_number: number } | null;
}

export interface MatchRecord {
  winnerId: string;
  loserId: string;
  time: number;
  tierName: string;
  seasonNumber: number | null;
  stipulation: string | null;
}

export interface StreakRecord {
  participantId: string;
  length: number;
  active: boolean;
  seasonSpan: string; // "S1" or "S1–S3"
}

export interface UpsetRecord {
  winnerId: string;
  loserId: string;
  winnerOvr: number;
  loserOvr: number;
  diff: number;
  tierName: string;
  seasonNumber: number | null;
}

export interface LeaderRecord {
  participantId: string;
  value: string; // display value, e.g. "31" or "84%" or "4:12"
  detail: string; // e.g. "31-6 career" or "22 matches"
}

export interface RecordBook {
  fastestMatches: MatchRecord[];
  longestMatches: MatchRecord[];
  winStreaks: StreakRecord[];
  lossStreaks: StreakRecord[];
  upsets: UpsetRecord[];
  leaders: {
    mostWins: LeaderRecord | null;
    bestWinPct: LeaderRecord | null;
    mostMatches: LeaderRecord | null;
    mostTitles: LeaderRecord | null;
    quickestAvg: LeaderRecord | null;
    longestAvg: LeaderRecord | null;
  };
}

const TOP_N = 5;
const MIN_MATCHES_FOR_PCT = 10;
const MIN_MATCHES_FOR_AVG = 5;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function computeRecordBook(
  matches: RecordMatchRow[],
  ovrMap: Map<string, number>
): RecordBook {
  const played = matches.filter(
    (m) => m.played_at && (m.winner_wrestler_id || m.winner_tag_team_id)
  );

  const participantsOf = (m: RecordMatchRow) => {
    const winner = (m.winner_wrestler_id || m.winner_tag_team_id)!;
    const a = (m.wrestler_a_id || m.tag_team_a_id)!;
    const b = (m.wrestler_b_id || m.tag_team_b_id)!;
    return { winner, loser: winner === a ? b : a };
  };
  const tierNameOf = (m: RecordMatchRow) =>
    m.tiers?.short_name || m.tiers?.name || "?";

  // ── Fastest / longest matches ─────────────────────────────────────────────
  const timed = played
    .filter((m) => (m.match_time_seconds ?? 0) > 0)
    .map((m) => {
      const { winner, loser } = participantsOf(m);
      return {
        winnerId: winner,
        loserId: loser,
        time: m.match_time_seconds!,
        tierName: tierNameOf(m),
        seasonNumber: m.seasons?.season_number ?? null,
        stipulation: m.stipulation,
      };
    });
  const fastestMatches = [...timed].sort((a, b) => a.time - b.time).slice(0, TOP_N);
  const longestMatches = [...timed].sort((a, b) => b.time - a.time).slice(0, TOP_N);

  // ── Streaks (career, across seasons) ──────────────────────────────────────
  const careerMatches = new Map<string, RecordMatchRow[]>();
  for (const m of played) {
    const { winner, loser } = participantsOf(m);
    for (const id of [winner, loser]) {
      if (!careerMatches.has(id)) careerMatches.set(id, []);
      careerMatches.get(id)!.push(m);
    }
  }

  const winStreaks: StreakRecord[] = [];
  const lossStreaks: StreakRecord[] = [];
  for (const [id, list] of careerMatches) {
    const ordered = [...list].sort(
      (a, b) => new Date(a.played_at!).getTime() - new Date(b.played_at!).getTime()
    );
    let bestWin = { length: 0, endIdx: -1 };
    let bestLoss = { length: 0, endIdx: -1 };
    let curWin = 0;
    let curLoss = 0;
    ordered.forEach((m, idx) => {
      const won = participantsOf(m).winner === id;
      curWin = won ? curWin + 1 : 0;
      curLoss = won ? 0 : curLoss + 1;
      if (curWin > bestWin.length) bestWin = { length: curWin, endIdx: idx };
      if (curLoss > bestLoss.length) bestLoss = { length: curLoss, endIdx: idx };
    });

    const spanOf = (best: { length: number; endIdx: number }) => {
      const start = ordered[best.endIdx - best.length + 1];
      const end = ordered[best.endIdx];
      const s1 = start?.seasons?.season_number;
      const s2 = end?.seasons?.season_number;
      if (!s1 && !s2) return "";
      return s1 === s2 ? `S${s1}` : `S${s1}–S${s2}`;
    };
    if (bestWin.length >= 2) {
      winStreaks.push({
        participantId: id,
        length: bestWin.length,
        active: bestWin.endIdx === ordered.length - 1,
        seasonSpan: spanOf(bestWin),
      });
    }
    if (bestLoss.length >= 2) {
      lossStreaks.push({
        participantId: id,
        length: bestLoss.length,
        active: bestLoss.endIdx === ordered.length - 1,
        seasonSpan: spanOf(bestLoss),
      });
    }
  }
  winStreaks.sort((a, b) => b.length - a.length);
  lossStreaks.sort((a, b) => b.length - a.length);

  // ── Upsets (singles only — OVR differential) ──────────────────────────────
  const upsets: UpsetRecord[] = played
    .filter((m) => m.wrestler_a_id && m.wrestler_b_id)
    .flatMap((m) => {
      const { winner, loser } = participantsOf(m);
      const winnerOvr = ovrMap.get(winner);
      const loserOvr = ovrMap.get(loser);
      if (winnerOvr == null || loserOvr == null || winnerOvr >= loserOvr) return [];
      return [
        {
          winnerId: winner,
          loserId: loser,
          winnerOvr,
          loserOvr,
          diff: loserOvr - winnerOvr,
          tierName: tierNameOf(m),
          seasonNumber: m.seasons?.season_number ?? null,
        },
      ];
    })
    .sort((a, b) => b.diff - a.diff)
    .slice(0, TOP_N);

  // ── Career leaders ────────────────────────────────────────────────────────
  const career = new Map<
    string,
    { wins: number; losses: number; titles: number; totalTime: number; timed: number }
  >();
  for (const m of played) {
    const { winner, loser } = participantsOf(m);
    for (const id of [winner, loser]) {
      if (!career.has(id)) {
        career.set(id, { wins: 0, losses: 0, titles: 0, totalTime: 0, timed: 0 });
      }
      const c = career.get(id)!;
      if ((m.match_time_seconds ?? 0) > 0) {
        c.totalTime += m.match_time_seconds!;
        c.timed++;
      }
    }
    career.get(winner)!.wins++;
    career.get(loser)!.losses++;
    if (m.match_phase === "final") career.get(winner)!.titles++;
  }

  const rows = [...career.entries()].map(([id, c]) => ({
    id,
    ...c,
    total: c.wins + c.losses,
    winPct: c.wins + c.losses > 0 ? c.wins / (c.wins + c.losses) : 0,
    avgTime: c.timed > 0 ? c.totalTime / c.timed : 0,
  }));

  const top = <T>(list: T[], cmp: (a: T, b: T) => number): T | undefined =>
    [...list].sort(cmp)[0];

  const mostWinsRow = top(rows, (a, b) => b.wins - a.wins || a.losses - b.losses);
  const pctRows = rows.filter((r) => r.total >= MIN_MATCHES_FOR_PCT);
  const bestPctRow = top(pctRows, (a, b) => b.winPct - a.winPct || b.wins - a.wins);
  const mostMatchesRow = top(rows, (a, b) => b.total - a.total);
  const titleRows = rows.filter((r) => r.titles > 0);
  const mostTitlesRow = top(titleRows, (a, b) => b.titles - a.titles);
  const avgRows = rows.filter((r) => r.timed >= MIN_MATCHES_FOR_AVG);
  const quickestRow = top(avgRows, (a, b) => a.avgTime - b.avgTime);
  const longestRow = top(avgRows, (a, b) => b.avgTime - a.avgTime);

  return {
    fastestMatches,
    longestMatches,
    winStreaks: winStreaks.slice(0, TOP_N),
    lossStreaks: lossStreaks.slice(0, TOP_N),
    upsets,
    leaders: {
      mostWins: mostWinsRow
        ? { participantId: mostWinsRow.id, value: `${mostWinsRow.wins}`, detail: `${mostWinsRow.wins}-${mostWinsRow.losses} career` }
        : null,
      bestWinPct: bestPctRow
        ? { participantId: bestPctRow.id, value: `${(bestPctRow.winPct * 100).toFixed(0)}%`, detail: `${bestPctRow.wins}-${bestPctRow.losses} (min ${MIN_MATCHES_FOR_PCT})` }
        : null,
      mostMatches: mostMatchesRow
        ? { participantId: mostMatchesRow.id, value: `${mostMatchesRow.total}`, detail: "matches played" }
        : null,
      mostTitles: mostTitlesRow
        ? { participantId: mostTitlesRow.id, value: `${mostTitlesRow.titles}`, detail: mostTitlesRow.titles === 1 ? "championship" : "championships" }
        : null,
      quickestAvg: quickestRow
        ? { participantId: quickestRow.id, value: formatTime(quickestRow.avgTime), detail: `avg over ${quickestRow.timed} matches` }
        : null,
      longestAvg: longestRow
        ? { participantId: longestRow.id, value: formatTime(longestRow.avgTime), detail: `avg over ${longestRow.timed} matches` }
        : null,
    },
  };
}
