import { createClient } from "@/lib/supabase/server";
import { MatchEntry } from "@/components/season/match-entry";

export default async function MatchEntryPage() {
  const supabase = await createClient();

  // Get active season
  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .neq("status", "completed")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season || !["pool_play", "playoffs", "relegation"].includes(season.status)) {
    return (
      <div className="container max-w-screen-2xl px-4 py-8">
        <h1 className="text-3xl font-bold">Match Entry</h1>
        <p className="mt-4 text-muted-foreground">
          No active season in a playable phase.
        </p>
      </div>
    );
  }

  // Get tiers with divisions
  const { data: tiers } = await supabase
    .from("tiers")
    .select("*, divisions(name, division_type)")
    .order("tier_number");

  // Get unplayed matches for this season
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("season_id", season.id)
    .is("played_at", null)
    .order("tier_id")
    .order("round_number")
    .order("pool");

  // Get wrestler names
  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name")
    .eq("is_active", true);

  // Get tag team names
  const { data: tagTeams } = await supabase
    .from("tag_teams")
    .select("id, name")
    .eq("is_active", true);

  const wrestlerMap = Object.fromEntries(
    (wrestlers ?? []).map((w: { id: string; name: string }) => [w.id, w.name])
  );
  const tagTeamMap = Object.fromEntries(
    (tagTeams ?? []).map((t: { id: string; name: string }) => [t.id, t.name])
  );

  return (
    <div className="container max-w-lg px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Match Entry</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Season {season.season_number} &middot; {matches?.length ?? 0} matches
        remaining
      </p>
      <MatchEntry
        seasonId={season.id}
        tiers={(tiers ?? []) as any}
        matches={(matches ?? []) as any}
        wrestlerMap={wrestlerMap}
        tagTeamMap={tagTeamMap}
      />
    </div>
  );
}
