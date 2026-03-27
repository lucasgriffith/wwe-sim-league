import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function HistoryPage() {
  const supabase = await createClient();

  const { data: seasons } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "completed")
    .order("season_number", { ascending: false });

  // Get champions for each completed season
  const seasonIds = (seasons ?? []).map((s) => s.id);
  let championsMap: Record<string, Array<{ tierName: string; holderName: string; tierNumber: number }>> = {};
  let matchCountMap: Record<string, number> = {};

  if (seasonIds.length > 0) {
    const [{ data: finals }, { data: allMatches }, { data: tiers }, { data: wrestlers }, { data: tagTeams }] =
      await Promise.all([
        supabase
          .from("matches")
          .select("season_id, tier_id, winner_wrestler_id, winner_tag_team_id")
          .in("season_id", seasonIds)
          .eq("match_phase", "final")
          .not("played_at", "is", null),
        supabase
          .from("matches")
          .select("season_id")
          .in("season_id", seasonIds)
          .not("played_at", "is", null),
        supabase.from("tiers").select("id, name, short_name, tier_number").order("tier_number"),
        supabase.from("wrestlers").select("id, name"),
        supabase.from("tag_teams").select("id, name"),
      ]);

    const tierMap = Object.fromEntries(
      (tiers ?? []).map((t) => [t.id, { name: t.short_name || t.name, number: t.tier_number }])
    );
    const nameMap = Object.fromEntries([
      ...(wrestlers ?? []).map((w) => [w.id, w.name] as const),
      ...(tagTeams ?? []).map((t) => [t.id, t.name] as const),
    ]);

    // Match counts
    for (const m of allMatches ?? []) {
      matchCountMap[m.season_id] = (matchCountMap[m.season_id] ?? 0) + 1;
    }

    // Champions
    for (const f of finals ?? []) {
      if (!championsMap[f.season_id]) championsMap[f.season_id] = [];
      const winnerId = f.winner_wrestler_id || f.winner_tag_team_id;
      const tier = tierMap[f.tier_id];
      championsMap[f.season_id].push({
        tierName: tier?.name ?? "?",
        holderName: nameMap[winnerId ?? ""] ?? "?",
        tierNumber: tier?.number ?? 99,
      });
    }

    for (const sid of Object.keys(championsMap)) {
      championsMap[sid].sort((a, b) => a.tierNumber - b.tierNumber);
    }
  }

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Season History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {seasons?.length ?? 0} completed season{(seasons?.length ?? 0) !== 1 ? "s" : ""}
        </p>
      </div>

      {seasons && seasons.length > 0 ? (
        <div className="space-y-4 stagger-children">
          {seasons.map((season) => {
            const champs = championsMap[season.id] ?? [];
            const matchCount = matchCountMap[season.id] ?? 0;
            return (
              <Link key={season.id} href={`/history/${season.id}`}>
                <Card className="card-hover cursor-pointer border-border/40 transition-all">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold font-bold tabular-nums">
                          {season.season_number}
                        </div>
                        <div>
                          <span className="text-base font-semibold">
                            Season {season.season_number}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {season.started_at &&
                              new Date(season.started_at).toLocaleDateString()}{" "}
                            —{" "}
                            {season.completed_at &&
                              new Date(season.completed_at).toLocaleDateString()}
                            {matchCount > 0 && (
                              <span className="ml-2">· {matchCount} matches</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-muted-foreground/40 shrink-0"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>

                    {champs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {champs.slice(0, 8).map((c, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[10px] border-gold/15 text-gold/70 gap-0.5"
                          >
                            🏆 {c.holderName}
                            <span className="text-gold/40">· {c.tierName}</span>
                          </Badge>
                        ))}
                        {champs.length > 8 && (
                          <Badge variant="outline" className="text-[10px] border-border/30 text-muted-foreground">
                            +{champs.length - 8} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/40 bg-card/30 px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No History Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete a season to see it here.
          </p>
        </div>
      )}
    </div>
  );
}
