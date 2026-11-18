import { computeStandings } from "./compute-standings";

/**
 * "Bubble watch": the tightest races around the lines that matter in each
 * tier — the playoff line, the promotion places and the drop zone. A race is
 * the gap in games between the last participant above a line and the first
 * one below it, using the same whole-tier order as standings and relegation.
 */

export type RaceKind = "playoff" | "promotion" | "drop";

export interface Race {
  kind: RaceKind;
  tierId: string;
  tierSlug: string | null;
  tierNumber: number;
  tierName: string;
  divisionName: string;
  /** Holding the place */
  above: { id: string; wins: number; losses: number };
  /** Chasing it */
  below: { id: string; wins: number; losses: number };
  /** Games between them (0 = level on record, separated by tiebreak) */
  gap: number;
  /** How far through its schedule the tier is, 0–1 */
  progress: number;
}

interface TierRow {
  id: string;
  slug?: string | null;
  tier_number: number;
  name: string;
  short_name?: string | null;
  has_pools: boolean;
  division_id: string;
  divisions?: unknown;
}

interface AssignmentRow {
  tier_id: string;
  pool?: string | null;
  wrestler_id: string | null;
  tag_team_id: string | null;
}

interface MatchRow {
  id: string;
  tier_id: string;
  match_phase: string;
  played_at: string | null;
  wrestler_a_id: string | null;
  wrestler_b_id: string | null;
  tag_team_a_id: string | null;
  tag_team_b_id: string | null;
  winner_wrestler_id: string | null;
  winner_tag_team_id: string | null;
  match_time_seconds: number | null;
}

export function computeRaces(
  tiers: TierRow[],
  assignments: AssignmentRow[],
  matches: MatchRow[],
  limit = 4
): Race[] {
  const races: Race[] = [];
  const byDivision = new Map<string, TierRow[]>();
  for (const t of tiers) {
    if (!byDivision.has(t.division_id)) byDivision.set(t.division_id, []);
    byDivision.get(t.division_id)!.push(t);
  }

  for (const divTiers of byDivision.values()) {
    const numbers = divTiers.map((t) => t.tier_number);
    const top = Math.min(...numbers);
    const bottom = Math.max(...numbers);

    for (const t of divTiers) {
      const ids = assignments
        .filter((a) => a.tier_id === t.id)
        .map((a) => (a.wrestler_id ?? a.tag_team_id)!)
        .filter(Boolean);
      const n = ids.length;
      if (n < 5) continue;

      const pool = matches.filter((m) => m.tier_id === t.id && m.match_phase === "pool_play");
      const played = pool.filter(
        (m) => m.played_at && (m.winner_wrestler_id || m.winner_tag_team_id)
      );
      // Too early to call anything a race
      if (pool.length === 0 || played.length / pool.length < 0.3) continue;
      if (played.length === pool.length) continue;

      const order = computeStandings(
        ids.map((id) => ({ id, name: id })),
        played.map((m) => ({
          id: m.id,
          wrestlerAId: (m.wrestler_a_id || m.tag_team_a_id)!,
          wrestlerBId: (m.wrestler_b_id || m.tag_team_b_id)!,
          winnerId: (m.winner_wrestler_id || m.winner_tag_team_id)!,
          matchTimeSeconds: m.match_time_seconds ?? 0,
        }))
      );

      const divisionName =
        (t.divisions as { name?: string } | null | undefined)?.name ?? "";
      const add = (kind: RaceKind, lineAfter: number) => {
        const a = order[lineAfter - 1];
        const b = order[lineAfter];
        if (!a || !b || a.matchesPlayed < 2 || b.matchesPlayed < 2) return;
        const gap = (a.wins - a.losses - (b.wins - b.losses)) / 2;
        races.push({
          kind,
          tierId: t.id,
          tierSlug: t.slug ?? null,
          tierNumber: t.tier_number,
          tierName: t.short_name || t.name,
          divisionName,
          above: { id: a.participantId, wins: a.wins, losses: a.losses },
          below: { id: b.participantId, wins: b.wins, losses: b.losses },
          gap: Math.max(0, gap),
          progress: played.length / pool.length,
        });
      };

      if (t.tier_number !== bottom) add("drop", n - 2);
      if (t.tier_number !== top) add("promotion", 2);
      // Six make the bracket in pooled tiers, two in round-robin tag tiers
      add("playoff", t.has_pools ? 6 : 2);
    }
  }

  // Tightest first; among equally tight races, the ones nearest the finish
  races.sort((a, b) => a.gap - b.gap || b.progress - a.progress);

  // At most two races per tier, so one chaotic tier doesn't fill the panel
  const perTier = new Map<string, number>();
  const out: Race[] = [];
  for (const r of races) {
    const c = perTier.get(r.tierId) ?? 0;
    if (c >= 1) continue;
    perTier.set(r.tierId, c + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}
