import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getStatusLabel, getStatusColor } from "@/lib/season/state-machine";

export default async function SeasonPage() {
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .neq("status", "completed")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return (
      <div className="container max-w-screen-2xl px-4 py-8">
        <h1 className="text-3xl font-bold">Current Season</h1>
        <p className="mt-4 text-muted-foreground">
          No active season. Start one from{" "}
          <Link href="/season/setup" className="text-primary hover:underline">
            Season Setup
          </Link>
          .
        </p>
      </div>
    );
  }

  // Get match counts per tier
  const { data: matches } = await supabase
    .from("matches")
    .select("id, tier_id, played_at, match_phase")
    .eq("season_id", season.id);

  const { data: tiers } = await supabase
    .from("tiers")
    .select("id, tier_number, name, short_name, division_id, divisions(name)")
    .order("tier_number");

  // Recent results
  const { data: recentMatches } = await supabase
    .from("matches")
    .select("*, wrestlers_a:wrestlers!matches_wrestler_a_id_fkey(name), wrestlers_b:wrestlers!matches_wrestler_b_id_fkey(name)")
    .eq("season_id", season.id)
    .not("played_at", "is", null)
    .order("played_at", { ascending: false })
    .limit(10);

  // Compute tier progress
  const tierProgress = (tiers ?? []).map((tier) => {
    const tierMatches = (matches ?? []).filter(
      (m) => m.tier_id === tier.id && m.match_phase === "pool_play"
    );
    const played = tierMatches.filter((m) => m.played_at).length;
    const total = tierMatches.length;
    return { ...tier, played, total };
  });

  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-3xl font-bold">
          Season {season.season_number}
        </h1>
        <Badge className={getStatusColor(season.status)}>
          {getStatusLabel(season.status)}
        </Badge>
      </div>

      {/* Tier progress */}
      <h2 className="mb-3 text-xl font-semibold">Tier Progress</h2>
      <div className="mb-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {tierProgress
          .filter((t) => t.total > 0)
          .map((tier) => (
            <Link key={tier.id} href={`/tiers/${tier.id}`}>
              <Card className="cursor-pointer transition-colors hover:bg-accent/50">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      T{tier.tier_number}:{" "}
                      {tier.short_name || tier.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tier.played}/{tier.total}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${tier.total > 0 ? (tier.played / tier.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>

      {/* Recent results */}
      {recentMatches && recentMatches.length > 0 && (
        <>
          <h2 className="mb-3 text-xl font-semibold">Recent Results</h2>
          <div className="space-y-2">
            {recentMatches.map((m) => {
              const aName =
                (m.wrestlers_a as { name: string } | null)?.name ?? "?";
              const bName =
                (m.wrestlers_b as { name: string } | null)?.name ?? "?";
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
                  <span className="text-muted-foreground">vs</span>
                  <span
                    className={
                      !isAWinner
                        ? "font-bold text-gold"
                        : "text-muted-foreground"
                    }
                  >
                    {bName}
                  </span>
                  {m.stipulation && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {m.stipulation}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
