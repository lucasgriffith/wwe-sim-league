import {
  computeElo,
  seedFromOvr,
  PROVISIONAL_MATCHES,
  type EloEntry,
  type MatchOdds,
} from "./compute-elo";

/**
 * The league-wide Elo board: one consistent set of ratings and rankings for
 * every page. Rankings are per pool — men's singles, women's singles, men's
 * tag, women's tag — and only count participants who have wrestled.
 */

export type EloPool = "men" | "women" | "men-tag" | "women-tag";

export const POOL_LABEL: Record<EloPool, string> = {
  men: "Men's",
  women: "Women's",
  "men-tag": "Men's Tag",
  "women-tag": "Women's Tag",
};

export interface EloStanding {
  id: string;
  pool: EloPool;
  rating: number;
  peak: number;
  matches: number;
  wins: number;
  losses: number;
  /** Fewer than 10 matches: rating still settling (shown with a "?") */
  provisional: boolean;
  /** 1-based rank within the pool */
  rank: number;
  poolSize: number;
  /** Rank before this participant's pool played its most recent match day */
  previousRank: number | null;
  /** Rating change from their most recent match */
  lastDelta: number;
  /** Best win by opponent rating at the time */
  bestWin: { opponentId: string; opponentRating: number } | null;
}

interface WrestlerRow {
  id: string;
  gender: string | null;
  overall_rating: number | null;
}

interface TagTeamRow {
  id: string;
  wrestler_a_id: string;
  wrestler_b_id: string;
}

type MatchRows = Parameters<typeof computeElo>[0];

/** What one match did to one participant's rating and pool rank */
export interface EloMove {
  delta: number;
  rating: number;
  /** Null when this was their first match, so they had no rank yet */
  rankBefore: number | null;
  rankAfter: number;
}

export interface EloBoard {
  /** Rating and rank movement for both sides of every played match, by match id */
  moves: Map<string, { a: EloMove; b: EloMove }>;
  entries: Map<string, EloEntry>;
  standings: Map<string, EloStanding>;
  /** Pool members in rank order */
  ranked: Record<EloPool, EloStanding[]>;
  /** Pre-match odds for every played match, keyed by match id */
  odds: Map<string, MatchOdds>;
  /** Starting rating for anyone who has not wrestled yet */
  seeds: Map<string, number>;
}

function rankPools(
  entries: Map<string, EloEntry>,
  poolOf: Map<string, EloPool>
): Map<string, number> {
  const byPool = new Map<EloPool, Array<[string, EloEntry]>>();
  for (const [id, e] of entries) {
    const pool = poolOf.get(id);
    if (!pool || e.matches === 0) continue;
    if (!byPool.has(pool)) byPool.set(pool, []);
    byPool.get(pool)!.push([id, e]);
  }
  const ranks = new Map<string, number>();
  for (const list of byPool.values()) {
    list
      .sort((a, b) => b[1].rating - a[1].rating || b[1].wins - a[1].wins)
      .forEach(([id], i) => ranks.set(id, i + 1));
  }
  return ranks;
}

function poolsAndSeeds(wrestlers: WrestlerRow[], tagTeams: TagTeamRow[]) {
  const wrestlerById = new Map(wrestlers.map((w) => [w.id, w]));
  const poolOf = new Map<string, EloPool>();
  const seeds = new Map<string, number>();

  for (const w of wrestlers) {
    poolOf.set(w.id, w.gender === "female" ? "women" : "men");
    seeds.set(w.id, seedFromOvr(w.overall_rating));
  }
  for (const t of tagTeams) {
    const a = wrestlerById.get(t.wrestler_a_id);
    const b = wrestlerById.get(t.wrestler_b_id);
    poolOf.set(t.id, a?.gender === "female" ? "women-tag" : "men-tag");
    const ovrs = [a?.overall_rating, b?.overall_rating].filter(
      (o): o is number => o != null
    );
    seeds.set(
      t.id,
      seedFromOvr(ovrs.length ? ovrs.reduce((s, o) => s + o, 0) / ovrs.length : null)
    );
  }
  return { poolOf, seeds };
}

/**
 * A participant's rank within their pool after each of their matches, in the
 * same order as their Elo history. Replays the league up to each match, so
 * it is only computed for the one profile being viewed.
 */
export function rankTimeline(
  matches: MatchRows,
  wrestlers: WrestlerRow[],
  tagTeams: TagTeamRow[],
  id: string,
  history: Array<{ playedAt: string }>
): number[] {
  const { poolOf, seeds } = poolsAndSeeds(wrestlers, tagTeams);
  const played = matches.filter((m) => m.played_at);
  return history.map((h) => {
    const cutoff = new Date(h.playedAt).getTime();
    const upTo = played.filter((m) => new Date(m.played_at!).getTime() <= cutoff);
    return rankPools(computeElo(upTo, seeds), poolOf).get(id) ?? 0;
  });
}

export function buildEloBoard(
  matches: MatchRows,
  wrestlers: WrestlerRow[],
  tagTeams: TagTeamRow[]
): EloBoard {
  const { poolOf, seeds } = poolsAndSeeds(wrestlers, tagTeams);

  const odds = new Map<string, MatchOdds>();
  // Rank movement per match: re-rank the pool after each result and compare
  // with how that pool stood after its previous one
  const moves = new Map<string, { a: EloMove; b: EloMove }>();
  const lastRanks = new Map<EloPool, Map<string, number>>();
  const entries = computeElo(matches, seeds, odds, (m, live) => {
    const pool = poolOf.get(m.a);
    if (!pool || !m.id) return;
    const before = lastRanks.get(pool);
    const after = new Map<string, number>();
    [...live]
      .filter(([id, e]) => poolOf.get(id) === pool && e.matches > 0)
      .sort((x, y) => y[1].rating - x[1].rating || y[1].wins - x[1].wins)
      .forEach(([id], i) => after.set(id, i + 1));
    lastRanks.set(pool, after);
    const side = (id: string, delta: number): EloMove => ({
      delta,
      rating: Math.round(live.get(id)!.rating),
      rankBefore: before?.get(id) ?? null,
      rankAfter: after.get(id)!,
    });
    moves.set(m.id, { a: side(m.a, m.deltaA), b: side(m.b, m.deltaB) });
  });
  const ranks = rankPools(entries, poolOf);

  // Previous ranks: the board as it stood before the latest day of results
  const playedDates = matches
    .filter((m) => m.played_at)
    .map((m) => m.played_at!.slice(0, 10))
    .sort();
  const latestDay = playedDates[playedDates.length - 1];
  const previousRanks = latestDay
    ? rankPools(
        computeElo(
          matches.filter((m) => m.played_at && m.played_at.slice(0, 10) < latestDay),
          seeds
        ),
        poolOf
      )
    : new Map<string, number>();

  const poolSizes = new Map<EloPool, number>();
  for (const id of ranks.keys()) {
    const pool = poolOf.get(id)!;
    poolSizes.set(pool, (poolSizes.get(pool) ?? 0) + 1);
  }

  const standings = new Map<string, EloStanding>();
  const ranked: Record<EloPool, EloStanding[]> = {
    men: [],
    women: [],
    "men-tag": [],
    "women-tag": [],
  };

  for (const [id, e] of entries) {
    const pool = poolOf.get(id);
    const rank = ranks.get(id);
    if (!pool || !rank) continue;
    const wins = e.history.filter((h) => h.won);
    const best = wins.sort((a, b) => b.opponentRating - a.opponentRating)[0];
    const standing: EloStanding = {
      id,
      pool,
      rating: Math.round(e.rating),
      peak: Math.round(e.peak),
      matches: e.matches,
      wins: e.wins,
      losses: e.matches - e.wins,
      provisional: e.matches < PROVISIONAL_MATCHES,
      rank,
      poolSize: poolSizes.get(pool) ?? 0,
      previousRank: previousRanks.get(id) ?? null,
      lastDelta: e.history[e.history.length - 1]?.delta ?? 0,
      bestWin: best
        ? { opponentId: best.opponentId, opponentRating: best.opponentRating }
        : null,
    };
    standings.set(id, standing);
    ranked[pool].push(standing);
  }
  for (const pool of Object.keys(ranked) as EloPool[]) {
    ranked[pool].sort((a, b) => a.rank - b.rank);
  }

  return { entries, standings, ranked, odds, seeds, moves };
}
