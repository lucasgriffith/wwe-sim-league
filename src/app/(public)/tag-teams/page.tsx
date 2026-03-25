import { createClient } from "@/lib/supabase/server";
import { TagTeamList } from "@/components/tag-teams/tag-team-list";

export default async function TagTeamsPage() {
  const supabase = await createClient();

  const { data: tagTeams } = await supabase
    .from("tag_teams")
    .select("*, wrestler_a:wrestlers!tag_teams_wrestler_a_id_fkey(id, name, gender), wrestler_b:wrestlers!tag_teams_wrestler_b_id_fkey(id, name, gender)")
    .order("name");

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name, gender")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Tag Teams</h1>
      <p className="mb-6 text-muted-foreground">
        {tagTeams?.length ?? 0} teams
      </p>
      <TagTeamList tagTeams={tagTeams ?? []} wrestlers={wrestlers ?? []} />
    </div>
  );
}
