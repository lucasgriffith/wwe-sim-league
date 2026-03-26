import { createClient } from "@/lib/supabase/server";
import { SeasonSetup } from "@/components/season/season-setup";
import { SeasonWizard } from "@/components/season/season-wizard";

export default async function SeasonSetupPage() {
  const supabase = await createClient();

  // Get active season or latest non-completed
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
    .select("season_number, id, status")
    .order("season_number", { ascending: false });

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
    .select("id, name, gender, overall_rating")
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

  // Get previous season's assignments (for carry-forward in Season 2+)
  let previousAssignments: Array<{
    wrestler_id: string | null;
    tag_team_id: string | null;
    tier_id: string;
    pool: string | null;
  }> = [];

  const lastCompletedSeason = (allSeasons ?? []).find(
    (s) => s.status === "completed"
  );

  if (lastCompletedSeason) {
    const { data } = await supabase
      .from("tier_assignments")
      .select("wrestler_id, tag_team_id, tier_id, pool")
      .eq("season_id", lastCompletedSeason.id);
    previousAssignments = data ?? [];
  }

  // Show wizard when: no season exists, or season is in setup phase
  const showWizard = !season || season.status === "setup";

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Season Setup</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {showWizard
          ? season
            ? `Season ${season.season_number} — Setup in progress`
            : `Ready to start Season ${nextSeasonNumber}`
          : `Season ${season!.season_number} — ${season!.status.replace("_", " ")}`}
      </p>

      {showWizard ? (
        <SeasonWizard
          season={season as any}
          nextSeasonNumber={season ? season.season_number : nextSeasonNumber}
          tiers={(tiers ?? []) as any}
          wrestlers={(wrestlers ?? []) as any}
          tagTeams={(tagTeams ?? []) as any}
          assignments={assignments as any}
          previousAssignments={previousAssignments}
        />
      ) : (
        <SeasonSetup
          season={season as any}
          nextSeasonNumber={nextSeasonNumber}
          tiers={(tiers ?? []) as any}
          wrestlers={(wrestlers ?? []) as any}
          tagTeams={(tagTeams ?? []) as any}
          assignments={assignments as any}
        />
      )}
    </div>
  );
}
