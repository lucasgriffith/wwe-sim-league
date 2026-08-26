import { createClient } from "@/lib/supabase/server";
import {
  getCurrentSeason,
  getSeasonMatches,
  getTagTeams,
  getTiers,
  getWrestlers,
} from "@/lib/data/cached";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getStatusLabel, getStatusColor } from "@/lib/season/state-machine";
import { UpcomingSchedule } from "@/components/season/upcoming-schedule";

const statusSteps = ["setup", "pool_play", "playoffs", "relegation", "completed"] as const;

export default async function SeasonPage() {
  const supabase = await createClient();

  const [season, tiers, wrestlers, tagTeams, userResult] = await Promise.all([
    getCurrentSeason(),
    getTiers(),
    getWrestlers(),
    getTagTeams(),
    supabase.auth.getUser(),
  ]);

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
  const user = userResult.data.user;
  const isAdmin = !!user;

  const seasonMatches = await getSeasonMatches(season.id);
  const matches = seasonMatches;

  // Decorate cached match rows with the participant-name shape the
  // components expect (previously done with relational joins)
  const wrestlerNames = Object.fromEntries(wrestlers.map((w) => [w.id, w.name]));
  const tagTeamNames = Object.fromEntries(tagTeams.map((t) => [t.id, t.name]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withNames = (m: any) => ({
    ...m,
    wrestlers_a: m.wrestler_a_id ? { name: wrestlerNames[m.wrestler_a_id] ?? "?" } : null,
    wrestlers_b: m.wrestler_b_id ? { name: wrestlerNames[m.wrestler_b_id] ?? "?" } : null,
    tag_teams_a: m.tag_team_a_id ? { name: tagTeamNames[m.tag_team_a_id] ?? "?" } : null,
    tag_teams_b: m.tag_team_b_id ? { name: tagTeamNames[m.tag_team_b_id] ?? "?" } : null,
  });

  const recentMatches = seasonMatches
    .filter((m) => m.played_at)
    .sort(
      (a, b) =>
        new Date(b.played_at!).getTime() - new Date(a.played_at!).getTime()
    )
    .slice(0, 10)
    .map(withNames);

  const upcomingMatches = seasonMatches
    .filter((m) => !m.played_at)
    .sort(
      (a, b) =>
        a.tier_id.localeCompare(b.tier_id) ||
        (a.round_number ?? Infinity) - (b.round_number ?? Infinity)
    )
    .slice(0, 50)
    .map(withNames);

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
