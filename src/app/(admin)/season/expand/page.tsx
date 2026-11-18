import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { MidSeasonExpansion } from "@/components/season/mid-season-expansion";
import { sortByName } from "@/lib/utils/sort-name";

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
        <PageHeader admin kicker="Season control" title="Mid-Season Expansion" description="No season currently in pool play phase." />
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
      <PageHeader
        admin
        kicker={`Season ${season.season_number}`}
        title="Mid-Season Expansion"
        description="Add new wrestlers and generate catch-up matches."
      />
      <MidSeasonExpansion
        seasonId={season.id}
        tiers={(tiers ?? []) as any}
        assignments={(assignments ?? []) as any}
        unassignedWrestlers={sortByName(unassigned) as any}
      />
    </div>
  );
}
