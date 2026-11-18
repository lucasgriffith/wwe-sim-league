import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getTagTeams, getWrestlers } from "@/lib/data/cached";
import { TagTeamList } from "@/components/tag-teams/tag-team-list";
import { sortByName } from "@/lib/utils/sort-name";

export default async function TagTeamsPage() {
  const supabase = await createClient();

  const [tagTeams, allWrestlers, { data: { user } }] = await Promise.all([
    getTagTeams(),
    getWrestlers(),
    supabase.auth.getUser(),
  ]);
  const wrestlers = allWrestlers.filter((w) => w.is_active);

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <PageHeader
        kicker="The tag division"
        title="Tag Teams"
        stats={[{ label: "Teams", value: tagTeams?.length ?? 0 }]}
      />
      <TagTeamList
        tagTeams={tagTeams ?? []}
        wrestlers={sortByName(wrestlers ?? [])}
        isAdmin={!!user}
      />
    </div>
  );
}
