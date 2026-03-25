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

  const { data: relegationEvents } = await supabase
    .from("relegation_events")
    .select("*, tiers(name, tier_number)")
    .eq("season_id", seasonId);

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <Link
        href="/history"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to History
      </Link>

      <div className="mt-6 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Season {season.season_number}
        </h1>
        {season.started_at && (
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(season.started_at).toLocaleDateString()} —{" "}
            {season.completed_at ? new Date(season.completed_at).toLocaleDateString() : ""}
          </p>
        )}
      </div>

      {/* Champions */}
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Champions
      </h2>
      {(finals ?? []).length > 0 ? (
        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
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
                <Card key={final.id} className="card-hover border-border/40 bg-gradient-to-br from-gold/5 to-transparent">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider text-gold border-gold/20">
                        T{tier?.tier_number}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground/60">
                        {tier?.divisions?.name}
                      </span>
                    </div>
                    <CardTitle className="text-sm mt-1">{tier?.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base font-bold gradient-text-gold">
                      {getWinnerName(final)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      ) : (
        <p className="mb-10 text-sm text-muted-foreground">No champion data available.</p>
      )}

      {/* Relegation movements */}
      {relegationEvents && relegationEvents.length > 0 && (
        <div className="animate-slide-up">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Relegation Movement
          </h2>
          <div className="space-y-2">
            {relegationEvents.map((evt) => {
              const name = evt.wrestler_id
                ? wrestlerMap[evt.wrestler_id] ?? "?"
                : evt.tag_team_id
                ? tagTeamMap[evt.tag_team_id] ?? "?"
                : "?";
              const isUp = evt.movement_type.includes("promote") || evt.movement_type === "playoff_survive";
              return (
                <div key={evt.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-4 py-3 text-sm">
                  <span className={`text-lg ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                    {isUp ? "↑" : "↓"}
                  </span>
                  <span className="font-medium">{name}</span>
                  <Badge variant="outline" className={`text-[10px] ml-auto ${
                    isUp ? "border-emerald-500/20 text-emerald-400" : "border-red-500/20 text-red-400"
                  }`}>
                    {evt.movement_type.replace(/_/g, " ")}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
