import { buildEloBoard, POOL_LABEL } from "@/lib/elo/board";
import { tierColor } from "@/lib/tiers/colors";
import { sortByName } from "@/lib/utils/sort-name";
import type { Rarity, TradingCardData } from "@/components/cards/trading-card";

interface WrestlerRow {
  id: string;
  slug: string | null;
  name: string;
  gender: string | null;
  overall_rating: number | null;
  image_url: string | null;
  is_active: boolean;
}

interface TierRow {
  id: string;
  slug?: string | null;
  name: string;
  short_name: string | null;
  tier_number: number;
}

type BoardArgs = Parameters<typeof buildEloBoard>;

/**
 * Build the full card set. Card numbers are alphabetical over the whole
 * roster so a wrestler keeps the same number wherever their card appears.
 */
export function buildCards({
  wrestlers,
  tagTeams,
  matches,
  tiers,
  assignments,
  championIds,
  seasonNumber,
}: {
  wrestlers: WrestlerRow[];
  tagTeams: BoardArgs[2];
  matches: BoardArgs[0];
  tiers: TierRow[];
  /** Current-season assignments */
  assignments: Array<{ tier_id: string; wrestler_id: string | null }>;
  championIds: Set<string>;
  seasonNumber: number | null;
}): TradingCardData[] {
  const board = buildEloBoard(matches, wrestlers, tagTeams);
  const tierById = new Map(tiers.map((t) => [t.id, t]));
  const tierOf = new Map<string, TierRow>();
  for (const a of assignments) {
    const t = tierById.get(a.tier_id);
    if (a.wrestler_id && t) tierOf.set(a.wrestler_id, t);
  }

  const titles = new Map<string, number>();
  for (const m of matches as Array<{ match_phase?: string | null; played_at: string | null; winner_wrestler_id: string | null }>) {
    if (m.match_phase === "final" && m.played_at && m.winner_wrestler_id) {
      titles.set(m.winner_wrestler_id, (titles.get(m.winner_wrestler_id) ?? 0) + 1);
    }
  }

  const ordered = sortByName(wrestlers);
  return ordered.map((w, i) => {
    const s = board.standings.get(w.id);
    const tier = tierOf.get(w.id) ?? null;
    let rarity: Rarity = "roster";
    if (championIds.has(w.id)) rarity = "champion";
    else if (s && s.rank <= 5) rarity = "main-event";
    else if (s && s.rank <= 25) rarity = "ranked";
    return {
      id: w.id,
      href: `/roster/${w.slug ?? w.id}`,
      number: i + 1,
      setSize: ordered.length,
      name: w.name,
      imageUrl: w.image_url,
      ovr: w.overall_rating,
      elo: s ? s.rating : null,
      rank: s && s.rank <= 25 ? s.rank : null,
      poolLabel: s ? POOL_LABEL[s.pool] : w.gender === "female" ? "Women's" : "Men's",
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      titles: titles.get(w.id) ?? 0,
      tierNumber: tier?.tier_number ?? null,
      tierName: tier ? tier.short_name || tier.name : null,
      color: tier ? tierColor(tier.slug ?? tier.name) : { bg: "#2a2a32", fg: "#f4f1ea" },
      rarity,
      seasonNumber,
    };
  });
}
