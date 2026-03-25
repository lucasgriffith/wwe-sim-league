import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function WrestlerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: wrestler } = await supabase
    .from("wrestlers")
    .select("*")
    .eq("id", id)
    .single();

  if (!wrestler) notFound();

  // Get tier assignments across seasons
  const { data: assignments } = await supabase
    .from("tier_assignments")
    .select("*, tiers(name, tier_number, division_id), seasons(season_number, status)")
    .eq("wrestler_id", id)
    .order("created_at", { ascending: false });

  // Get career match stats
  const { data: matchesA } = await supabase
    .from("matches")
    .select("id, winner_wrestler_id")
    .eq("wrestler_a_id", id)
    .not("played_at", "is", null);

  const { data: matchesB } = await supabase
    .from("matches")
    .select("id, winner_wrestler_id")
    .eq("wrestler_b_id", id)
    .not("played_at", "is", null);

  const allMatches = [...(matchesA ?? []), ...(matchesB ?? [])];
  const wins = allMatches.filter((m) => m.winner_wrestler_id === id).length;
  const losses = allMatches.length - wins;

  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <Link
        href="/roster"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to Roster
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-3xl font-bold">{wrestler.name}</h1>
        <div className="mt-2 flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              wrestler.gender === "male"
                ? "border-division-mens-singles text-division-mens-singles"
                : "border-division-womens-singles text-division-womens-singles"
            }
          >
            {wrestler.gender === "male" ? "Male" : "Female"}
          </Badge>
          {wrestler.brand && (
            <Badge variant="secondary">{wrestler.brand}</Badge>
          )}
          <Badge variant={wrestler.is_active ? "default" : "secondary"}>
            {wrestler.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Overall Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {wrestler.overall_rating ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Career Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {wins}W - {losses}L
            </p>
            {allMatches.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {((wins / allMatches.length) * 100).toFixed(1)}% win rate
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Seasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {assignments?.length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {assignments && assignments.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Tier History</h2>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="px-4 py-2">Season</th>
                  <th className="px-4 py-2">Tier</th>
                  <th className="px-4 py-2">Pool</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b">
                    <td className="px-4 py-2">
                      Season{" "}
                      {(a.seasons as { season_number: number })?.season_number}
                    </td>
                    <td className="px-4 py-2">
                      {(a.tiers as { name: string })?.name}
                    </td>
                    <td className="px-4 py-2">{a.pool || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
