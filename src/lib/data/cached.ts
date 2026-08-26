import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { getCurrentChampions, type ChampionInfo } from "@/lib/champions";

/**
 * Cached public-data layer.
 *
 * Every table is public-read under RLS, and there is exactly one writer (the
 * admin), so public pages don't need per-request queries: reads go through a
 * cookie-less anon client and are cached across requests under LEAGUE_TAG.
 * Every mutating server action busts the tag (see actions.ts), and a 5-minute
 * TTL self-heals anything changed outside the app (e.g. SQL editor edits).
 */

export const LEAGUE_TAG = "league-data";
const TTL_SECONDS = 300;

function publicClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

const opts = { tags: [LEAGUE_TAG], revalidate: TTL_SECONDS };

/** Latest non-completed season (setup included), or null. */
export const getCurrentSeason = unstable_cache(
  async () => {
    const { data } = await publicClient()
      .from("seasons")
      .select("*")
      .neq("status", "completed")
      .order("season_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  },
  ["current-season"],
  opts
);

/** Latest season actively playing (pool play / playoffs / relegation), or null. */
export const getActivePlaySeason = unstable_cache(
  async () => {
    const { data } = await publicClient()
      .from("seasons")
      .select("*")
      .in("status", ["pool_play", "playoffs", "relegation"])
      .order("season_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  },
  ["active-play-season"],
  opts
);

export const getAllSeasons = unstable_cache(
  async () => {
    const { data } = await publicClient()
      .from("seasons")
      .select("*")
      .order("season_number", { ascending: false });
    return data ?? [];
  },
  ["all-seasons"],
  opts
);

export const getCompletedSeasons = unstable_cache(
  async () => {
    const { data } = await publicClient()
      .from("seasons")
      .select("*")
      .eq("status", "completed")
      .order("season_number", { ascending: false });
    return data ?? [];
  },
  ["completed-seasons"],
  opts
);

export const getSeasonById = unstable_cache(
  async (seasonId: string) => {
    const { data } = await publicClient()
      .from("seasons")
      .select("*")
      .eq("id", seasonId)
      .maybeSingle();
    return data;
  },
  ["season-by-id"],
  opts
);

export const getWrestlers = unstable_cache(
  async () => {
    const { data } = await publicClient()
      .from("wrestlers")
      .select("*")
      .order("name");
    return data ?? [];
  },
  ["wrestlers"],
  opts
);

export const getTagTeams = unstable_cache(
  async () => {
    const { data } = await publicClient()
      .from("tag_teams")
      .select(
        "*, wrestler_a:wrestlers!tag_teams_wrestler_a_id_fkey(id, name, image_url, gender), wrestler_b:wrestlers!tag_teams_wrestler_b_id_fkey(id, name, image_url, gender)"
      )
      .order("name");
    return data ?? [];
  },
  ["tag-teams"],
  opts
);

export const getDivisions = unstable_cache(
  async () => {
    const { data } = await publicClient()
      .from("divisions")
      .select("*")
      .order("display_order");
    return data ?? [];
  },
  ["divisions"],
  opts
);

export const getTiers = unstable_cache(
  async () => {
    const { data } = await publicClient()
      .from("tiers")
      .select("*, divisions(name, gender, division_type)")
      .order("tier_number");
    return data ?? [];
  },
  ["tiers"],
  opts
);

export const getSeasonMatches = unstable_cache(
  async (seasonId: string) => {
    const { data } = await publicClient()
      .from("matches")
      .select("*")
      .eq("season_id", seasonId);
    return data ?? [];
  },
  ["season-matches"],
  opts
);

export const getSeasonAssignments = unstable_cache(
  async (seasonId: string) => {
    const { data } = await publicClient()
      .from("tier_assignments")
      .select(
        "*, wrestlers(id, name, slug, image_url), tag_teams(id, name, wrestler_a:wrestlers!tag_teams_wrestler_a_id_fkey(image_url), wrestler_b:wrestlers!tag_teams_wrestler_b_id_fkey(image_url))"
      )
      .eq("season_id", seasonId);
    return data ?? [];
  },
  ["season-assignments"],
  opts
);

/**
 * Every match across all seasons, with tier/season display info joined.
 * Powers career views (profiles, dynasty, history counts) from one cached set.
 */
export const getAllMatches = unstable_cache(
  async () => {
    const { data } = await publicClient()
      .from("matches")
      .select(
        "*, tiers(id, name, short_name, tier_number, belt_image_url, divisions(name)), seasons(season_number)"
      );
    return data ?? [];
  },
  ["all-matches"],
  opts
);

/** Every tier assignment across all seasons, with tier/season info joined. */
export const getAllAssignments = unstable_cache(
  async () => {
    const { data } = await publicClient()
      .from("tier_assignments")
      .select(
        "*, tiers(id, name, short_name, tier_number), seasons(season_number, status)"
      );
    return data ?? [];
  },
  ["all-assignments"],
  opts
);

export const getSeasonRelegationEvents = unstable_cache(
  async (seasonId: string) => {
    const { data } = await publicClient()
      .from("relegation_events")
      .select("*, tiers(name, tier_number)")
      .eq("season_id", seasonId);
    return data ?? [];
  },
  ["season-relegation-events"],
  opts
);

/** Reigning champions from the most recently completed season. */
export const getChampions = unstable_cache(
  async (): Promise<Record<string, ChampionInfo>> => {
    return getCurrentChampions(publicClient());
  },
  ["champions"],
  opts
);
