import { createClient } from "@/lib/supabase/server";
import { RumbleSeeding } from "@/components/rumble/rumble-seeding";

export default async function RumblePage() {
  const supabase = await createClient();

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name, gender, overall_rating")
    .eq("is_active", true)
    .order("name");

  const { data: tagTeams } = await supabase
    .from("tag_teams")
    .select("id, name, wrestler_a:wrestlers!tag_teams_wrestler_a_id_fkey(gender)")
    .eq("is_active", true)
    .order("name");

  const { data: tiers } = await supabase
    .from("tiers")
    .select("*, divisions(name, gender, division_type)")
    .order("tier_number");

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "setup")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Royal Rumble Seeding</h1>
      <p className="mb-6 text-muted-foreground">
        Enter elimination order to auto-generate tier assignments.
      </p>
      <RumbleSeeding
        wrestlers={(wrestlers ?? []) as any}
        tagTeams={(tagTeams ?? []) as any}
        tiers={(tiers ?? []) as any}
        season={season as any}
      />
    </div>
  );
}
