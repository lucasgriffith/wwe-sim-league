export type StandingZone =
  | "playoff" // Pool top 2 — qualifies for the bracket
  | "wildcard" // Best 2 remaining across BOTH pools
  | "safe"
  | "relplayoff" // 3rd/4th from the bottom of the TIER — Steel Cage defense
  | "autorel"; // Bottom 2 of the TIER — automatic relegation

/**
 * Zone assignment matching how movement actually works: playoff qualification
 * is per-pool (top 2), but wild cards and relegation are decided on TIER-WIDE
 * standings — the bottom 2 of the tier can both come from one pool.
 */
export function assignZones({
  poolRowIds,
  combinedOrder,
  hasBracket,
}: {
  poolRowIds: string[][]; // per pool, in display order
  combinedOrder: string[]; // canonical whole-tier order, best first
  hasBracket: boolean; // pooled tiers have wild-card slots; tag tiers don't
}): Map<string, StandingZone> {
  const qualified = new Set(poolRowIds.flatMap((ids) => ids.slice(0, 2)));
  const n = combinedOrder.length;
  const wildcardSet = new Set(
    hasBracket
      ? combinedOrder.filter((id) => !qualified.has(id)).slice(0, 2)
      : []
  );

  const zones = new Map<string, StandingZone>();
  combinedOrder.forEach((id, idx) => {
    const pos = idx + 1;
    let zone: StandingZone = "safe";
    if (qualified.has(id)) zone = "playoff";
    else if (wildcardSet.has(id)) zone = "wildcard";
    else if (n > 4 && pos > n - 2) zone = "autorel";
    else if (n > 6 && pos > n - 4) zone = "relplayoff";
    zones.set(id, zone);
  });
  return zones;
}
