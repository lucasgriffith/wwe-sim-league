import { createClient } from "@/lib/supabase/server";
import { MidSeasonExpansion } from "@/components/season/mid-season-expansion";

export default async function ExpandPage() {
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "pool_play")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return (
      <div className="container max-w-screen-2xl px-4 py-8">
        <h1 className="text-3xl font-bold">Mid-Season Expansion</h1>
        <p className="mt-4 text-muted-foreground">
          No season currently in pool play phase.
        </p>
      </div>
    );
  }

  // Get all tiers with divisions
  const { data: tiers } = await supabase
    .from("tiers")
    .select("id, name, short_name, tier_number, pool_size, has_pools, slug, divisions(name, gender, division_type)")
    .order("tier_number");

  // Get current assignments
  const { data: assignments } = await supabase
    .from("tier_assignments")
    .select("tier_id, wrestler_id, tag_team_id, pool")
    .eq("season_id", season.id);

  // Get all active wrestlers
  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name, gender, overall_rating, image_url, slug")
    .eq("is_active", true)
    .order("name");

  // Find unassigned wrestlers
  const assignedWrestlerIds = new Set(
    (assignments ?? []).filter((a) => a.wrestler_id).map((a) => a.wrestler_id)
  );
  const unassigned = (wrestlers ?? []).filter(
    (w) => !assignedWrestlerIds.has(w.id)
  );

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        Mid-Season Expansion
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Season {season.season_number} — Add new wrestlers and generate catch-up
        matches
      </p>
      <MidSeasonExpansion
        seasonId={season.id}
        tiers={(tiers ?? []) as any}
        assignments={(assignments ?? []) as any}
        unassignedWrestlers={unassigned as any}
      />
    </div>
  );
}
