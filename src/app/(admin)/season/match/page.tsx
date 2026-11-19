import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { MatchEntry } from "@/components/season/match-entry";
import { MatchEntryTabs } from "@/components/season/match-entry-tabs";

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
        <PageHeader admin kicker="Season control" title="Match Entry" description="No active season in a playable phase." />
      </div>
    );
  }

  // Get tiers with divisions
  const { data: tiers } = await supabase
    .from("tiers")
    .select("*, divisions(name, division_type)")
    .order("tier_number");

  // Get ALL matches for this season (both played and unplayed) for progress tracking
  const allMatches = await fetchAllRows((from, to) =>
    supabase
      .from("matches")
      .select("*")
      .eq("season_id", season.id)
      .order("tier_id")
      .order("round_number")
      .order("pool")
      .order("id")
      .range(from, to)
  );

  const unplayedMatches = (allMatches ?? []).filter((m) => !m.played_at);
  const playedCount = (allMatches ?? []).length - unplayedMatches.length;
  const totalCount = (allMatches ?? []).length;

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
    <div className="container max-w-lg px-4 py-8 animate-fade-in">
      <PageHeader
        admin
        kicker={`Season ${season.season_number}`}
        title="Match Entry"
        stats={[
          { label: "Played", value: playedCount },
          { label: "Left", value: totalCount - playedCount },
        ]}
      />
      <MatchEntryTabs
        seasonId={season.id}
        tiers={(tiers ?? []) as any}
        matches={unplayedMatches as any}
        wrestlerMap={wrestlerMap}
        tagTeamMap={tagTeamMap}
        playedCount={playedCount}
        totalCount={totalCount}
      />
    </div>
  );
}
