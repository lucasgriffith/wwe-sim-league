import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getStatusLabel, getStatusColor } from "@/lib/season/state-machine";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Current season
  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .neq("status", "completed")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Counts
  const { count: wrestlerCount } = await supabase
    .from("wrestlers")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: tagTeamCount } = await supabase
    .from("tag_teams")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: completedSeasons } = await supabase
    .from("seasons")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  // Recent matches
  let recentMatches: Array<{
    id: string;
    wrestler_a_id: string | null;
    wrestler_b_id: string | null;
    winner_wrestler_id: string | null;
    stipulation: string | null;
    match_phase: string;
  }> = [];

  if (season) {
    const { data } = await supabase
      .from("matches")
      .select("id, wrestler_a_id, wrestler_b_id, winner_wrestler_id, stipulation, match_phase")
      .eq("season_id", season.id)
      .not("played_at", "is", null)
      .order("played_at", { ascending: false })
      .limit(5);
    recentMatches = data ?? [];
  }

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name");
  const wrestlerMap = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.name])
  );

  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold">
          <span className="text-gold">WWE 2K26</span> Simulation League
        </h1>
        <p className="mt-1 text-muted-foreground">
          CPU-vs-CPU championship simulation with tiered relegation
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Active Wrestlers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{wrestlerCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Tag Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tagTeamCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Completed Seasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completedSeasons ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Current Season
            </CardTitle>
          </CardHeader>
          <CardContent>
            {season ? (
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">#{season.season_number}</p>
                <Badge className={getStatusColor(season.status)}>
                  {getStatusLabel(season.status)}
                </Badge>
              </div>
            ) : (
              <p className="text-3xl font-bold text-muted-foreground">-</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/season/setup">
          <Button variant="outline">Season Setup</Button>
        </Link>
        <Link href="/season/match">
          <Button className="bg-gold text-black hover:bg-gold-dark">
            Enter Match
          </Button>
        </Link>
        <Link href="/season/playoffs">
          <Button variant="outline">Playoffs</Button>
        </Link>
        <Link href="/season/relegation">
          <Button variant="outline">Relegation</Button>
        </Link>
        <Link href="/rumble">
          <Button variant="outline">Royal Rumble</Button>
        </Link>
      </div>

      {/* Recent results */}
      {recentMatches.length > 0 && (
        <div>
          <h2 className="mb-3 text-xl font-semibold">Recent Results</h2>
          <div className="space-y-2">
            {recentMatches.map((m) => {
              const aName = wrestlerMap[m.wrestler_a_id ?? ""] ?? "?";
              const bName = wrestlerMap[m.wrestler_b_id ?? ""] ?? "?";
              const isAWinner = m.winner_wrestler_id === m.wrestler_a_id;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span
                    className={
                      isAWinner ? "font-bold text-gold" : "text-muted-foreground"
                    }
                  >
                    {aName}
                  </span>
                  <span className="text-muted-foreground">def.</span>
                  <span
                    className={
                      !isAWinner ? "font-bold text-gold" : "text-muted-foreground"
                    }
                  >
                    {bName}
                  </span>
                  <Badge variant="outline" className="ml-auto text-xs capitalize">
                    {m.match_phase.replace("_", " ")}
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
