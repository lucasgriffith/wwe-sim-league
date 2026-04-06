import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChampionInfo {
  beltName: string;
  beltImageUrl: string | null;
  tierNumber: number;
}

/**
 * Build a champion map from pre-fetched final match data and tier info.
 * Each entry is keyed by wrestler_id or tag_team_id.
 */
export function buildChampionMap(
  finals: Array<{
    winner_wrestler_id: string | null;
    winner_tag_team_id: string | null;
    tier_id: string;
  }>,
  tiers: Array<{
    id: string;
    name: string;
    short_name: string | null;
    belt_image_url: string | null;
    tier_number: number;
  }>
): Record<string, ChampionInfo> {
  const tierMap = Object.fromEntries(tiers.map((t) => [t.id, t]));
  const champions: Record<string, ChampionInfo> = {};

  for (const f of finals) {
    const championId = f.winner_wrestler_id ?? f.winner_tag_team_id;
    if (!championId) continue;

    const tier = tierMap[f.tier_id];
    if (!tier) continue;

    champions[championId] = {
      beltName: tier.short_name || tier.name,
      beltImageUrl: tier.belt_image_url ?? null,
      tierNumber: tier.tier_number,
    };
  }

  return champions;
}

/**
 * Query the most recently completed season's final matches
 * to determine current champions.
 */
export async function getCurrentChampions(
  supabase: SupabaseClient
): Promise<Record<string, ChampionInfo>> {
  // Find the most recent completed season
  const { data: completedSeason } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "completed")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!completedSeason) {
    return {};
  }

  // Get all final matches from that season that have been played
  const { data: finals } = await supabase
    .from("matches")
    .select("winner_wrestler_id, winner_tag_team_id, tier_id")
    .eq("season_id", completedSeason.id)
    .eq("match_phase", "final")
    .not("played_at", "is", null);

  if (!finals || finals.length === 0) {
    return {};
  }

  // Get tier info for belt names and images
  const tierIds = [...new Set(finals.map((f) => f.tier_id))];
  const { data: tiers } = await supabase
    .from("tiers")
    .select("id, name, short_name, belt_image_url, tier_number")
    .in("id", tierIds);

  if (!tiers) {
    return {};
  }

  return buildChampionMap(finals, tiers);
}
