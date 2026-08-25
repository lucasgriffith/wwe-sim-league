export interface CarryAssignment {
  wrestler_id: string | null;
  tag_team_id: string | null;
  tier_id: string;
  pool: string | null;
}

export interface MovementEvent {
  wrestler_id: string | null;
  tag_team_id: string | null;
  movement_type: string;
  to_tier_id: string | null;
}

/**
 * Apply a completed season's relegation/promotion events to its assignments,
 * producing the starting assignments for the next season. Participants who
 * moved tiers get their pool reassigned to keep pools balanced; everyone else
 * keeps their pool.
 */
export function applyMovements(
  previousAssignments: CarryAssignment[],
  events: MovementEvent[],
  tiers: Array<{ id: string; has_pools: boolean }>
): CarryAssignment[] {
  const MOVING = new Set([
    "auto_promote",
    "auto_relegate",
    "playoff_promote",
    "playoff_relegate",
  ]);

  const destination = new Map<string, string>();
  for (const e of events) {
    if (!MOVING.has(e.movement_type) || !e.to_tier_id) continue;
    const pid = e.wrestler_id || e.tag_team_id;
    if (pid) destination.set(pid, e.to_tier_id);
  }

  const moved = previousAssignments.map((a) => {
    const pid = (a.wrestler_id || a.tag_team_id)!;
    const newTier = destination.get(pid);
    if (newTier && newTier !== a.tier_id) {
      return { ...a, tier_id: newTier, pool: null };
    }
    return { ...a };
  });

  // Rebalance pools per pooled tier: movers (pool null) fill the smaller pool
  const hasPoolsMap = new Map(tiers.map((t) => [t.id, t.has_pools]));
  const byTier = new Map<string, CarryAssignment[]>();
  for (const a of moved) {
    if (!byTier.has(a.tier_id)) byTier.set(a.tier_id, []);
    byTier.get(a.tier_id)!.push(a);
  }

  for (const [tierId, members] of byTier) {
    if (!hasPoolsMap.get(tierId)) {
      members.forEach((m) => (m.pool = null));
      continue;
    }
    let countA = members.filter((m) => m.pool === "A").length;
    let countB = members.filter((m) => m.pool === "B").length;
    for (const m of members) {
      if (m.pool === "A" || m.pool === "B") continue;
      if (countA <= countB) {
        m.pool = "A";
        countA++;
      } else {
        m.pool = "B";
        countB++;
      }
    }
  }

  return moved;
}
