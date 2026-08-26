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
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Tag Teams</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {tagTeams?.length ?? 0} teams
      </p>
      <TagTeamList
        tagTeams={tagTeams ?? []}
        wrestlers={sortByName(wrestlers ?? [])}
        isAdmin={!!user}
      />
    </div>
  );
}
