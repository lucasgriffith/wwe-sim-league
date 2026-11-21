import { computeStandings, type StandingsRow } from "@/lib/standings/compute-standings";
import { assignZones, type StandingZone } from "@/lib/standings/zones";

/**
 * Where every tag team stands in the current season: its championship, its
 * place in the pool and in the whole tier, and the zone it sits in. Mirrors
 * the standings page: playoff places are per pool, wild cards and
 * relegation are decided on the tier-wide order.
 */

interface TierRow {
  id: string;
  slug?: string | null;
  name: string;
  short_name?: string | null;
  tier_number: number;
  has_pools: boolean;
  division_id: string;
  divisions?: unknown;
}

interface AssignmentRow {
  tier_id: string;
  tag_team_id: string | null;
  pool?: string | null;
}

interface MatchRow {
  id: string;
  tier_id: string;
  match_phase: string;
  played_at: string | null;
  tag_team_a_id: string | null;
  tag_team_b_id: string | null;
  winner_tag_team_id: string | null;
  match_time_seconds: number | null;
}

export interface TagTier {
  id: string;
  slug: string | null;
  name: string;
  shortName: string;
  tierNumber: number;
  divisionName: string;
  women: boolean;
  hasPools: boolean;
  /** Team ids in tier-wide order, best first */
  order: string[];
  /** Pool matches played and scheduled */
  played: number;
  scheduled: number;
}

export interface TagPlace {
  tier: TagTier;
  /** 1-based place in the tier-wide order */
  place: number;
  size: number;
  pool: string | null;
  /** 1-based place within the pool (same as place when the tier has none) */
  poolPlace: number;
  poolSize: number;
  row: StandingsRow;
  zone: StandingZone;
  /** Games behind the last playoff place (0 when holding one) */
  gamesBack: number;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function buildTagSeason(
  tiers: TierRow[],
  assignments: AssignmentRow[],
  matches: MatchRow[]
): { tiers: TagTier[]; places: Map<string, TagPlace> } {
  const tagTiers = tiers.filter(
    (t) => (t.divisions as { division_type?: string } | null)?.division_type === "tag"
  );
  const bottomOf = new Map<string, number>();
  for (const t of tagTiers) {
    bottomOf.set(t.division_id, Math.max(bottomOf.get(t.division_id) ?? 0, t.tier_number));
  }

  const out: TagTier[] = [];
  const places = new Map<string, TagPlace>();

  for (const t of tagTiers) {
    const ids = assignments
      .filter((a) => a.tier_id === t.id && a.tag_team_id)
      .map((a) => a.tag_team_id!);
    if (ids.length === 0) continue;

    const pool = matches.filter((m) => m.tier_id === t.id && m.match_phase === "pool_play");
    const played = pool.filter((m) => m.played_at && m.winner_tag_team_id);
    const table = (members: string[]) => {
      const set = new Set(members);
      return computeStandings(
        members.map((id) => ({ id, name: id })),
        played
          .filter((m) => set.has(m.tag_team_a_id!) && set.has(m.tag_team_b_id!))
          .map((m) => ({
            id: m.id,
            wrestlerAId: m.tag_team_a_id!,
            wrestlerBId: m.tag_team_b_id!,
            winnerId: m.winner_tag_team_id!,
            matchTimeSeconds: m.match_time_seconds ?? 0,
          }))
      );
    };
    const rows = table(ids);
    const order = rows.map((r) => r.participantId);
    const poolOf = new Map<string, string | null>();
    for (const a of assignments) {
      if (a.tier_id === t.id && a.tag_team_id) poolOf.set(a.tag_team_id, a.pool ?? null);
    }
    const poolTables = t.has_pools
      ? ["A", "B"].map((p) => ({
          pool: p as string | null,
          ids: table(ids.filter((id) => poolOf.get(id) === p)).map((r) => r.participantId),
        }))
      : [{ pool: null as string | null, ids: order }];
    const zones = assignZones({
      poolRowIds: poolTables.map((p) => p.ids),
      combinedOrder: order,
      hasBracket: t.has_pools,
    });
    const division = t.divisions as { name?: string; gender?: string } | null;
    const isBottom = bottomOf.get(t.division_id) === t.tier_number;

    const tier: TagTier = {
      id: t.id,
      slug: t.slug ?? null,
      name: t.name,
      shortName: t.short_name || t.name,
      tierNumber: t.tier_number,
      hasPools: t.has_pools,
      divisionName: division?.name ?? "",
      women: division?.gender === "female",
      order,
      played: played.length,
      scheduled: pool.length,
    };
    out.push(tier);

    // The last team currently inside the playoff picture
    const inside = rows.filter((r) => {
      const z = zones.get(r.participantId);
      return z === "playoff" || z === "wildcard";
    });
    const line = inside[inside.length - 1];
    rows.forEach((row, i) => {
      let zone = zones.get(row.participantId) ?? "safe";
      // Nothing below the lowest tier to drop into
      if (isBottom && (zone === "autorel" || zone === "relplayoff")) zone = "safe";
      const contender = zone === "playoff" || zone === "wildcard";
      const gamesBack =
        line && !contender
          ? Math.max(0, (line.wins - line.losses - (row.wins - row.losses)) / 2)
          : 0;
      const mine = poolTables.find((p) => p.ids.includes(row.participantId));
      places.set(row.participantId, {
        tier,
        place: i + 1,
        size: rows.length,
        pool: mine?.pool ?? null,
        poolPlace: mine ? mine.ids.indexOf(row.participantId) + 1 : i + 1,
        poolSize: mine?.ids.length ?? rows.length,
        row,
        zone,
        gamesBack,
      });
    });
  }

  out.sort((a, b) => Number(a.women) - Number(b.women) || a.tierNumber - b.tierNumber);
  return { tiers: out, places };
}
