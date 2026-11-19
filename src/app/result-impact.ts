"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildEloBoard } from "@/lib/elo/board";
import { computeStandings } from "@/lib/standings/compute-standings";

export interface SideImpact {
  id: string;
  /** Elo */
  delta: number;
  rating: number;
  rankBefore: number | null;
  rankAfter: number;
  /** Place in their pool (or tier, when it has no pools) before and after */
  placeBefore: number | null;
  placeAfter: number | null;
  wins: number;
  losses: number;
}

export interface ResultImpact {
  winner: SideImpact;
  loser: SideImpact;
  /** The winner's chance going in, 0 to 1 */
  winnerProb: number;
  /** "Pool A", or "the tier" when there are no pools; null outside pool play */
  tableLabel: string | null;
  tableSize: number;
}

/**
 * What a just-recorded result did: Elo and Elo-rank movement for both sides,
 * and where each now sits in their pool. Read-only, and everything it reads
 * is public; it queries directly so it sees the result that was just saved
 * rather than a cached board.
 */
export async function getResultImpact(matchId: string): Promise<ResultImpact | null> {
  const admin = createAdminClient();

  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (!match?.played_at) return null;
  const aId = (match.wrestler_a_id || match.tag_team_a_id) as string;
  const bId = (match.wrestler_b_id || match.tag_team_b_id) as string;
  const winnerId = (match.winner_wrestler_id || match.winner_tag_team_id) as string | null;
  if (!winnerId) return null;
  const loserId = winnerId === aId ? bId : aId;

  // Every played match, paged past the 1000-row response cap
  const allMatches: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("matches")
      .select(
        "id, tier_id, season_id, pool, match_phase, played_at, match_time_seconds, wrestler_a_id, wrestler_b_id, tag_team_a_id, tag_team_b_id, winner_wrestler_id, winner_tag_team_id"
      )
      .not("played_at", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) return null;
    allMatches.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const [{ data: wrestlers }, { data: tagTeams }, { data: assigns }] = await Promise.all([
    admin.from("wrestlers").select("id, gender, overall_rating"),
    admin.from("tag_teams").select("id, wrestler_a_id, wrestler_b_id"),
    admin
      .from("tier_assignments")
      .select("wrestler_id, tag_team_id, pool")
      .eq("season_id", match.season_id)
      .eq("tier_id", match.tier_id),
  ]);

  type Rows = Parameters<typeof buildEloBoard>[0];
  const board = buildEloBoard(allMatches as unknown as Rows, wrestlers ?? [], tagTeams ?? []);
  const move = board.moves.get(matchId);
  const odds = board.odds.get(matchId);
  if (!move) return null;

  // Table places, pool play only: the same order the standings page uses
  let places: { before: Map<string, number>; after: Map<string, number> } | null = null;
  let tableLabel: string | null = null;
  let tableSize = 0;
  if (match.match_phase === "pool_play") {
    const members = (assigns ?? [])
      .filter((a) => match.pool === null || a.pool === match.pool)
      .map((a) => ({ id: (a.wrestler_id || a.tag_team_id) as string, name: "" }));
    const poolRows = (allMatches as Array<Record<string, string | number | null>>).filter(
      (m) =>
        m.season_id === match.season_id &&
        m.tier_id === match.tier_id &&
        m.match_phase === "pool_play" &&
        (match.pool === null || m.pool === match.pool) &&
        (m.winner_wrestler_id || m.winner_tag_team_id)
    );
    const toResult = (m: Record<string, string | number | null>) => ({
      id: m.id as string,
      wrestlerAId: (m.wrestler_a_id || m.tag_team_a_id) as string,
      wrestlerBId: (m.wrestler_b_id || m.tag_team_b_id) as string,
      winnerId: (m.winner_wrestler_id || m.winner_tag_team_id) as string,
      matchTimeSeconds: (m.match_time_seconds as number | null) ?? 0,
    });
    const rank = (rows: typeof poolRows) =>
      new Map(computeStandings(members, rows.map(toResult)).map((r) => [r.participantId, r.rank]));
    places = {
      before: rank(poolRows.filter((m) => m.id !== matchId)),
      after: rank(poolRows),
    };
    tableLabel = match.pool ? `Pool ${match.pool}` : "the tier";
    tableSize = members.length;
  }

  const record = (id: string) => {
    const mine = (allMatches as Array<Record<string, string | null>>).filter(
      (m) =>
        m.season_id === match.season_id &&
        m.tier_id === match.tier_id &&
        m.match_phase === "pool_play" &&
        [m.wrestler_a_id, m.wrestler_b_id, m.tag_team_a_id, m.tag_team_b_id].includes(id)
    );
    const wins = mine.filter((m) => (m.winner_wrestler_id || m.winner_tag_team_id) === id).length;
    return { wins, losses: mine.length - wins };
  };

  const side = (id: string): SideImpact => {
    const mv = id === aId ? move.a : move.b;
    return {
      id,
      delta: mv.delta,
      rating: mv.rating,
      rankBefore: mv.rankBefore,
      rankAfter: mv.rankAfter,
      placeBefore: places?.before.get(id) ?? null,
      placeAfter: places?.after.get(id) ?? null,
      ...record(id),
    };
  };

  return {
    winner: side(winnerId),
    loser: side(loserId),
    winnerProb: odds?.winnerProb ?? 0.5,
    tableLabel,
    tableSize,
  };
}
