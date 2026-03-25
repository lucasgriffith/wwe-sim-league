import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const { seasonId } = await params;
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", seasonId)
    .single();

  if (!season) notFound();

  // Get all finals for this season (champions)
  const { data: finals } = await supabase
    .from("matches")
    .select("*, tiers(name, short_name, tier_number, divisions(name))")
    .eq("season_id", seasonId)
    .eq("match_phase", "final")
    .not("played_at", "is", null);

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name");

  const { data: tagTeams } = await supabase
    .from("tag_teams")
    .select("id, name");

  const wrestlerMap = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.name])
  );
  const tagTeamMap = Object.fromEntries(
    (tagTeams ?? []).map((t) => [t.id, t.name])
  );

  function getWinnerName(m: NonNullable<typeof finals>[0]): string {
    if (m.winner_wrestler_id) return wrestlerMap[m.winner_wrestler_id] ?? "?";
    if (m.winner_tag_team_id) return tagTeamMap[m.winner_tag_team_id] ?? "?";
    return "?";
  }

  // Get relegation events
  const { data: relegationEvents } = await supabase
    .from("relegation_events")
    .select("*, tiers(name, tier_number)")
    .eq("season_id", seasonId);

  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <Link
        href="/history"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to History
      </Link>

      <h1 className="mt-4 mb-8 text-3xl font-bold">
        Season {season.season_number}
      </h1>

      {/* Champions */}
      <h2 className="mb-3 text-xl font-semibold">Champions</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(finals ?? [])
          .sort(
            (a, b) =>
              ((a.tiers as { tier_number: number })?.tier_number ?? 0) -
              ((b.tiers as { tier_number: number })?.tier_number ?? 0)
          )
          .map((final) => {
            const tier = final.tiers as {
              name: string;
              short_name: string;
              tier_number: number;
              divisions: { name: string };
            };
            return (
              <Card key={final.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">T{tier?.tier_number}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {tier?.divisions?.name}
                    </span>
                  </div>
                  <CardTitle className="text-sm">{tier?.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-bold text-gold">
                    {getWinnerName(final)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        {(!finals || finals.length === 0) && (
          <p className="text-muted-foreground">No champion data available.</p>
        )}
      </div>

      {/* Relegation movements */}
      {relegationEvents && relegationEvents.length > 0 && (
        <>
          <h2 className="mb-3 text-xl font-semibold">Relegation Movement</h2>
          <div className="space-y-2">
            {relegationEvents.map((evt) => {
              const name = evt.wrestler_id
                ? wrestlerMap[evt.wrestler_id] ?? "?"
                : evt.tag_team_id
                ? tagTeamMap[evt.tag_team_id] ?? "?"
                : "?";
              const color =
                evt.movement_type.includes("promote") || evt.movement_type === "playoff_survive"
                  ? "text-green-400"
                  : "text-red-400";
              return (
                <div key={evt.id} className="flex items-center gap-2 text-sm">
                  <span className={`font-medium ${color}`}>{name}</span>
                  <Badge variant="outline" className="text-xs">
                    {evt.movement_type.replace(/_/g, " ")}
                  </Badge>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
