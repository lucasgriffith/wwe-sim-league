/**
 * Career Elo ratings, computed by walking every played match in
 * chronological order across all seasons.
 *
 * - Everyone starts at 1200.
 * - Expected score: E = 1 / (1 + 10^((opponent - self) / 400))
 * - K-factor: 40 for a participant's first 10 matches (provisional — new
 *   entrants converge quickly), 24 after.
 *
 * Beating a much higher-rated opponent transfers many points; farming
 * lower-rated opponents transfers almost none. Singles wrestlers and tag
 * teams are independent entities — their matches never cross, so their
 * rating pools stay separate naturally.
 */

const BASE_RATING = 1200;
const PROVISIONAL_MATCHES = 10;
const K_PROVISIONAL = 40;
const K_ESTABLISHED = 24;

export interface EloHistoryPoint {
  rating: number;
  playedAt: string;
  seasonNumber: number | null;
  opponentId: string;
  won: boolean;
}

export interface EloEntry {
  rating: number;
  matches: number;
  peak: number;
  history: EloHistoryPoint[]; // chronological, one point per match
}

interface EloMatchRow {
  wrestler_a_id: string | null;
  wrestler_b_id: string | null;
  tag_team_a_id: string | null;
  tag_team_b_id: string | null;
  winner_wrestler_id: string | null;
  winner_tag_team_id: string | null;
  played_at: string | null;
  seasons?: { season_number: number } | null;
}

export function computeElo(matches: EloMatchRow[]): Map<string, EloEntry> {
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
      entries.set(id, {
        rating: BASE_RATING,
        matches: 0,
        peak: BASE_RATING,
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

    const expectedA = 1 / (1 + Math.pow(10, (eb.rating - ea.rating) / 400));
    const scoreA = winner === a ? 1 : 0;
    const kA = ea.matches < PROVISIONAL_MATCHES ? K_PROVISIONAL : K_ESTABLISHED;
    const kB = eb.matches < PROVISIONAL_MATCHES ? K_PROVISIONAL : K_ESTABLISHED;

    ea.rating += kA * (scoreA - expectedA);
    eb.rating += kB * (1 - scoreA - (1 - expectedA));
    ea.matches++;
    eb.matches++;
    ea.peak = Math.max(ea.peak, ea.rating);
    eb.peak = Math.max(eb.peak, eb.rating);

    const seasonNumber = m.seasons?.season_number ?? null;
    ea.history.push({
      rating: Math.round(ea.rating),
      playedAt: m.played_at!,
      seasonNumber,
      opponentId: b,
      won: scoreA === 1,
    });
    eb.history.push({
      rating: Math.round(eb.rating),
      playedAt: m.played_at!,
      seasonNumber,
      opponentId: a,
      won: scoreA === 0,
    });
  }

  return entries;
}

export function eloOf(
  entries: Map<string, EloEntry>,
  id: string
): number {
  return Math.round(entries.get(id)?.rating ?? BASE_RATING);
}

export function peakOf(
  entries: Map<string, EloEntry>,
  id: string
): number {
  return Math.round(entries.get(id)?.peak ?? BASE_RATING);
}
