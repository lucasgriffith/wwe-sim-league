import { createClient } from "@/lib/supabase/server";
import { PlayoffsManager } from "@/components/playoffs/playoffs-manager";

export default async function PlayoffsPage() {
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "playoffs")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return (
      <div className="container max-w-screen-2xl px-4 py-8">
        <h1 className="text-3xl font-bold">Playoffs</h1>
        <p className="mt-4 text-muted-foreground">
          No season currently in playoff phase.
        </p>
      </div>
    );
  }

  const { data: tiers } = await supabase
    .from("tiers")
    .select("*, divisions(name, division_type)")
    .order("tier_number");

  // Get all matches for the season
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("season_id", season.id);

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name");

  const { data: tagTeams } = await supabase
    .from("tag_teams")
    .select("id, name");

  const { data: assignments } = await supabase
    .from("tier_assignments")
    .select("*")
    .eq("season_id", season.id);

  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Playoffs</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Season {season.season_number}
      </p>
      <PlayoffsManager
        season={season}
        tiers={tiers ?? []}
        matches={matches ?? []}
        wrestlers={wrestlers ?? []}
        tagTeams={tagTeams ?? []}
        assignments={assignments ?? []}
      />
    </div>
  );
}
