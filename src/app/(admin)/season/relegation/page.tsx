import { createClient } from "@/lib/supabase/server";
import { RelegationManager } from "@/components/relegation/relegation-manager";

export default async function RelegationPage() {
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "relegation")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return (
      <div className="container max-w-screen-2xl px-4 py-8">
        <h1 className="text-3xl font-bold">Relegation</h1>
        <p className="mt-4 text-muted-foreground">
          No season currently in relegation phase.
        </p>
      </div>
    );
  }

  const { data: tiers } = await supabase
    .from("tiers")
    .select("*, divisions(name, gender, division_type)")
    .order("tier_number");

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("season_id", season.id);

  const { data: assignments } = await supabase
    .from("tier_assignments")
    .select("*")
    .eq("season_id", season.id);

  const { data: relegationEvents } = await supabase
    .from("relegation_events")
    .select("*")
    .eq("season_id", season.id);

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name");

  const { data: tagTeams } = await supabase
    .from("tag_teams")
    .select("id, name");

  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Relegation</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Season {season.season_number}
      </p>
      <RelegationManager
        season={season}
        tiers={tiers ?? []}
        matches={matches ?? []}
        assignments={assignments ?? []}
        relegationEvents={relegationEvents ?? []}
        wrestlers={wrestlers ?? []}
        tagTeams={tagTeams ?? []}
      />
    </div>
  );
}
