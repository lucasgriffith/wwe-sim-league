/**
 * Career Elo ratings, computed by walking every played match in
 * chronological order across all seasons. Nothing is stored — ratings are
 * always derived from match results, so they can never drift from the data.
 *
 * - Starting rating is seeded from the 2K overall rating when one is supplied
 *   (1200 at 80 OVR, ±10 per point), otherwise 1200. The seed is a prior:
 *   it fades as real results accumulate.
 * - Expected score: E = 1 / (1 + 10^((opponent - self) / 400))
 * - K-factor: 40 for a participant's first 10 matches (provisional — new
 *   entrants converge quickly), 24 after.
 * - Stakes: playoff and relegation matches move ratings 25% more, and
 *   championship finals 50% more.
 *
 * Beating a much higher-rated opponent transfers many points; farming
 * lower-rated opponents transfers almost none. Singles wrestlers and tag
 * teams are independent entities — their matches never cross, so their
 * rating pools stay separate naturally.
 */

export const BASE_RATING = 1200;
export const PROVISIONAL_MATCHES = 10;
const K_PROVISIONAL = 40;
const K_ESTABLISHED = 24;

const STAKES: Record<string, number> = {
  quarterfinal: 1.25,
  semifinal: 1.25,
  relegation: 1.25,
  final: 1.5,
};

/** Starting rating implied by a 2K overall rating. */
export function seedFromOvr(ovr: number | null | undefined): number {
  if (ovr == null) return BASE_RATING;
  return Math.max(1000, Math.min(1400, BASE_RATING + (ovr - 80) * 10));
}

export interface EloHistoryPoint {
  rating: number;
  delta: number; // rating change from this match
  playedAt: string;
  seasonNumber: number | null;
  opponentId: string;
  opponentRating: number; // opponent's rating going into the match
  won: boolean;
  phase: string | null; // pool_play, quarterfinal, semifinal, final, relegation
}

export interface EloEntry {
  rating: number;
  start: number;
  matches: number;
  wins: number;
  peak: number;
  history: EloHistoryPoint[]; // chronological, one point per match
}

interface EloMatchRow {
  id?: string;
  wrestler_a_id: string | null;
  wrestler_b_id: string | null;
  tag_team_a_id: string | null;
  tag_team_b_id: string | null;
  winner_wrestler_id: string | null;
  winner_tag_team_id: string | null;
  match_phase?: string | null;
  played_at: string | null;
  seasons?: { season_number: number } | null;
}

/** Chance that a participant rated `a` beats one rated `b`. */
export function winProbability(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** Pre-match picture of a played match, for upset detection. */
export interface MatchOdds {
  winnerId: string;
  /** The winner's chance of winning going in (low = upset) */
  winnerProb: number;
  winnerDelta: number;
}

export function computeElo(
  matches: EloMatchRow[],
  seeds?: Map<string, number>,
  oddsOut?: Map<string, MatchOdds>,
  /** Called after each match is applied, with the board as it then stands */
  onMatch?: (
    match: { id?: string; a: string; b: string; deltaA: number; deltaB: number },
    entries: Map<string, EloEntry>
  ) => void
): Map<string, EloEntry> {
  const played = matches
    .filter(
      (m) =>
        m.played_at &&
        (m.winner_wrestler_id || m.winner_tag_team_id) &&
        (m.wrestler_a_id || m.tag_team_a_id) &&
        (m.wrestler_b_id || m.tag_team_b_id)
    )
    .sort(
      (a, b) =>
        new Date(a.played_at!).getTime() - new Date(b.played_at!).getTime()
    );

  const entries = new Map<string, EloEntry>();
  const entryFor = (id: string): EloEntry => {
    if (!entries.has(id)) {
      const start = seeds?.get(id) ?? BASE_RATING;
      entries.set(id, {
        rating: start,
        start,
        matches: 0,
        wins: 0,
        peak: start,
        history: [],
      });
    }
    return entries.get(id)!;
  };

  for (const m of played) {
    const a = (m.wrestler_a_id || m.tag_team_a_id)!;
    const b = (m.wrestler_b_id || m.tag_team_b_id)!;
    const winner = (m.winner_wrestler_id || m.winner_tag_team_id)!;
    const ea = entryFor(a);
    const eb = entryFor(b);
    const beforeA = ea.rating;
    const beforeB = eb.rating;

    const expectedA = 1 / (1 + Math.pow(10, (beforeB - beforeA) / 400));
    const scoreA = winner === a ? 1 : 0;
    const stakes = STAKES[m.match_phase ?? ""] ?? 1;
    const kA = (ea.matches < PROVISIONAL_MATCHES ? K_PROVISIONAL : K_ESTABLISHED) * stakes;
    const kB = (eb.matches < PROVISIONAL_MATCHES ? K_PROVISIONAL : K_ESTABLISHED) * stakes;

    const deltaA = kA * (scoreA - expectedA);
    const deltaB = kB * (1 - scoreA - (1 - expectedA));
    ea.rating += deltaA;
    eb.rating += deltaB;
    if (oddsOut && m.id) {
      oddsOut.set(m.id, {
        winnerId: winner,
        winnerProb: scoreA === 1 ? expectedA : 1 - expectedA,
        winnerDelta: Math.round(scoreA === 1 ? deltaA : deltaB),
      });
    }
    ea.matches++;
    eb.matches++;
    if (scoreA === 1) ea.wins++;
    else eb.wins++;
    ea.peak = Math.max(ea.peak, ea.rating);
    eb.peak = Math.max(eb.peak, eb.rating);

    const seasonNumber = m.seasons?.season_number ?? null;
    ea.history.push({
      rating: Math.round(ea.rating),
      delta: Math.round(deltaA),
      playedAt: m.played_at!,
      seasonNumber,
      opponentId: b,
      opponentRating: Math.round(beforeB),
      won: scoreA === 1,
      phase: m.match_phase ?? null,
    });
    eb.history.push({
      rating: Math.round(eb.rating),
      delta: Math.round(deltaB),
      playedAt: m.played_at!,
      seasonNumber,
      opponentId: a,
      opponentRating: Math.round(beforeA),
      won: scoreA === 0,
      phase: m.match_phase ?? null,
    });
    onMatch?.(
      { id: m.id, a, b, deltaA: Math.round(deltaA), deltaB: Math.round(deltaB) },
      entries
    );
  }

  return entries;
}
