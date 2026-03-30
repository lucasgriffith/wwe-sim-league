import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getStatusLabel, getStatusColor } from "@/lib/season/state-machine";
import { UpcomingSchedule } from "@/components/season/upcoming-schedule";

const statusSteps = ["setup", "pool_play", "playoffs", "relegation", "completed"] as const;

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
      <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight">Current Season</h1>
        <div className="mt-8 rounded-xl border border-dashed border-border/40 bg-card/30 px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No Active Season</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start one from{" "}
            <Link href="/season/setup" className="text-gold hover:underline">
              Season Setup
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = !!user;

  const { data: matches } = await supabase
    .from("matches")
    .select("id, tier_id, played_at, match_phase")
    .eq("season_id", season.id);

  const { data: tiers } = await supabase
    .from("tiers")
    .select("id, tier_number, name, short_name, division_id, divisions(name, division_type)")
    .order("tier_number");

  // Get recent played matches with wrestler AND tag team names
  const { data: recentMatches } = await supabase
    .from("matches")
    .select(`
      id, tier_id, match_phase, pool, stipulation, played_at, match_time_seconds,
      wrestler_a_id, wrestler_b_id, winner_wrestler_id,
      tag_team_a_id, tag_team_b_id, winner_tag_team_id,
      wrestlers_a:wrestlers!matches_wrestler_a_id_fkey(name),
      wrestlers_b:wrestlers!matches_wrestler_b_id_fkey(name),
      tag_teams_a:tag_teams!matches_tag_team_a_id_fkey(name),
      tag_teams_b:tag_teams!matches_tag_team_b_id_fkey(name)
    `)
    .eq("season_id", season.id)
    .not("played_at", "is", null)
    .order("played_at", { ascending: false })
    .limit(10);

  // Get upcoming unplayed matches (for inline entry)
  const { data: upcomingMatches } = await supabase
    .from("matches")
    .select(`
      id, tier_id, match_phase, pool, round_number, stipulation,
      wrestler_a_id, wrestler_b_id,
      tag_team_a_id, tag_team_b_id,
      wrestlers_a:wrestlers!matches_wrestler_a_id_fkey(name),
      wrestlers_b:wrestlers!matches_wrestler_b_id_fkey(name),
      tag_teams_a:tag_teams!matches_tag_team_a_id_fkey(name),
      tag_teams_b:tag_teams!matches_tag_team_b_id_fkey(name)
    `)
    .eq("season_id", season.id)
    .is("played_at", null)
    .order("tier_id")
    .order("round_number")
    .limit(50);

  const tierMap = Object.fromEntries(
    (tiers ?? []).map((t) => [t.id, t])
  );

  const tierProgress = (tiers ?? []).map((tier) => {
    const tierMatches = (matches ?? []).filter(
      (m) => m.tier_id === tier.id && m.match_phase === "pool_play"
    );
    const played = tierMatches.filter((m) => m.played_at).length;
    const total = tierMatches.length;
    return { ...tier, played, total };
  });

  const currentStepIdx = statusSteps.indexOf(season.status);

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <div className="mb-8 flex items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Season {season.season_number}
        </h1>
        <Badge className={`${getStatusColor(season.status)} text-xs`}>
          {getStatusLabel(season.status)}
        </Badge>
      </div>

      {/* Status stepper */}
      <div className="mb-10 flex items-center gap-1">
        {statusSteps.map((step, i) => {
          const isCompleted = i < currentStepIdx;
          const isCurrent = i === currentStepIdx;
          return (
            <div key={step} className="flex items-center gap-1 flex-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                isCompleted ? "bg-gold/20 text-gold" :
                isCurrent ? "bg-gold text-black ring-2 ring-gold/30" :
                "bg-muted text-muted-foreground"
              }`}>
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < statusSteps.length - 1 && (
                <div className={`h-px flex-1 ${i < currentStepIdx ? "bg-gold/30" : "bg-border/40"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Left column */}
        <div className="space-y-8">
          {/* Tier progress */}
          <div>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tier Progress
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 stagger-children">
              {tierProgress
                .filter((t) => t.total > 0)
                .map((tier) => {
                  const pct = tier.total > 0 ? (tier.played / tier.total) * 100 : 0;
                  return (
                    <Link key={tier.id} href={`/tiers/${tier.id}`}>
                      <Card className="card-hover cursor-pointer border-border/40 transition-all">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              T{tier.tier_number}: {tier.short_name || tier.name}
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {tier.played}/{tier.total}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                pct === 100 ? "bg-emerald-500" : "bg-gold"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* Recent results */}
          {recentMatches && recentMatches.length > 0 && (
            <div className="animate-slide-up">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recent Results
              </h2>
              <div className="space-y-2">
                {recentMatches.map((m) => {
                  const isTag = !!m.tag_team_a_id;
                  const aName = isTag
                    ? (m.tag_teams_a as any)?.name ?? "?"
                    : (m.wrestlers_a as any)?.name ?? "?";
                  const bName = isTag
                    ? (m.tag_teams_b as any)?.name ?? "?"
                    : (m.wrestlers_b as any)?.name ?? "?";
                  const winnerId = isTag ? m.winner_tag_team_id : m.winner_wrestler_id;
                  const aId = isTag ? m.tag_team_a_id : m.wrestler_a_id;
                  const isAWinner = winnerId === aId;
                  const tier = tierMap[m.tier_id];
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-4 py-3 text-sm transition-all hover:border-border/60 hover:bg-card"
                    >
                      {tier && (
                        <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">
                          T{tier.tier_number}
                        </span>
                      )}
                      <span className={isAWinner ? "font-semibold text-gold" : "text-muted-foreground"}>
                        {aName}
                      </span>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                        vs
                      </span>
                      <span className={!isAWinner ? "font-semibold text-gold" : "text-muted-foreground"}>
                        {bName}
                      </span>
                      {m.stipulation && (
                        <Badge variant="secondary" className="ml-auto text-[10px] bg-wwe-red/10 text-wwe-red border-0">
                          {m.stipulation}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column — Upcoming Schedule with inline entry */}
        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Upcoming Matches
          </h2>
          <UpcomingSchedule
            matches={(upcomingMatches ?? []).map((m) => {
              const isTag = !!m.tag_team_a_id;
              return {
                id: m.id,
                tierId: m.tier_id,
                tierLabel: tierMap[m.tier_id]
                  ? `T${tierMap[m.tier_id].tier_number}`
                  : "",
                tierName: tierMap[m.tier_id]?.short_name || tierMap[m.tier_id]?.name || "",
                pool: m.pool,
                round: m.round_number,
                nameA: isTag
                  ? (m.tag_teams_a as any)?.name ?? "?"
                  : (m.wrestlers_a as any)?.name ?? "?",
                nameB: isTag
                  ? (m.tag_teams_b as any)?.name ?? "?"
                  : (m.wrestlers_b as any)?.name ?? "?",
                idA: isTag ? m.tag_team_a_id! : m.wrestler_a_id!,
                idB: isTag ? m.tag_team_b_id! : m.wrestler_b_id!,
                isTag,
              };
            })}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </div>
  );
}
