import { createClient } from "@/lib/supabase/server";
import { SeasonSetup } from "@/components/season/season-setup";

export default async function SeasonSetupPage() {
  const supabase = await createClient();

  // Get active season or latest
  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .neq("status", "completed")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get next season number
  const { data: allSeasons } = await supabase
    .from("seasons")
    .select("season_number")
    .order("season_number", { ascending: false })
    .limit(1);

  const nextSeasonNumber =
    allSeasons && allSeasons.length > 0
      ? allSeasons[0].season_number + 1
      : 1;

  // Get all tiers with divisions
  const { data: tiers } = await supabase
    .from("tiers")
    .select("*, divisions(name, gender, division_type)")
    .order("tier_number");

  // Get all active wrestlers
  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name, gender")
    .eq("is_active", true)
    .order("name");

  // Get all active tag teams
  const { data: tagTeams } = await supabase
    .from("tag_teams")
    .select("id, name, wrestler_a:wrestlers!tag_teams_wrestler_a_id_fkey(gender)")
    .eq("is_active", true)
    .order("name");

  // Get current tier assignments if season exists
  let assignments: Array<{
    id: string;
    tier_id: string;
    wrestler_id: string | null;
    tag_team_id: string | null;
    pool: string | null;
    seed: number | null;
  }> = [];

  if (season) {
    const { data } = await supabase
      .from("tier_assignments")
      .select("id, tier_id, wrestler_id, tag_team_id, pool, seed")
      .eq("season_id", season.id);
    assignments = data ?? [];
  }

  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Season Setup</h1>
      <SeasonSetup
        season={season as any}
        nextSeasonNumber={nextSeasonNumber}
        tiers={(tiers ?? []) as any}
        wrestlers={(wrestlers ?? []) as any}
        tagTeams={(tagTeams ?? []) as any}
        assignments={assignments as any}
      />
    </div>
  );
}
