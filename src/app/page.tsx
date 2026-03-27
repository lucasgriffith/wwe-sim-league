import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getStatusLabel, getStatusColor } from "@/lib/season/state-machine";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: season },
    { count: wrestlerCount },
    { count: tagTeamCount },
    { count: completedSeasons },
    { data: wrestlers },
  ] = await Promise.all([
    supabase
      .from("seasons")
      .select("*")
      .neq("status", "completed")
      .order("season_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("wrestlers")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("tag_teams")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("seasons")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase.from("wrestlers").select("id, name"),
  ]);

  const wrestlerMap = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.name])
  );

  // Fetch season-specific data
  let recentMatches: Array<{
    id: string;
    wrestler_a_id: string | null;
    wrestler_b_id: string | null;
    tag_team_a_id: string | null;
    tag_team_b_id: string | null;
    winner_wrestler_id: string | null;
    winner_tag_team_id: string | null;
    stipulation: string | null;
    match_phase: string;
    match_time_seconds: number | null;
    tier_id: string;
  }> = [];
  let tierProgress: Array<{
    tierId: string;
    tierNumber: number;
    tierName: string;
    played: number;
    total: number;
  }> = [];
  let totalPlayed = 0;
  let totalMatches = 0;

  if (season) {
    const [{ data: allMatches }, { data: tiers }, { data: tagTeamNames }] = await Promise.all([
      supabase
        .from("matches")
        .select("id, wrestler_a_id, wrestler_b_id, tag_team_a_id, tag_team_b_id, winner_wrestler_id, winner_tag_team_id, stipulation, match_phase, match_time_seconds, tier_id, played_at")
        .eq("season_id", season.id)
        .order("played_at", { ascending: false }),
      supabase
        .from("tiers")
        .select("id, tier_number, name, short_name")
        .order("tier_number"),
      supabase.from("tag_teams").select("id, name"),
    ]);

    const tagTeamMap = Object.fromEntries(
      (tagTeamNames ?? []).map((t) => [t.id, t.name])
    );

    recentMatches = (allMatches ?? [])
      .filter((m) => m.played_at)
      .slice(0, 10)
      .map((m) => ({ ...m, tagTeamMap })) as typeof recentMatches;

    // Add tag team names to wrestler map for display
    for (const t of tagTeamNames ?? []) {
      wrestlerMap[t.id] = t.name;
    }

    // Compute tier progress
    const matchesByTier = new Map<string, { played: number; total: number }>();
    for (const m of allMatches ?? []) {
      if (!matchesByTier.has(m.tier_id)) {
        matchesByTier.set(m.tier_id, { played: 0, total: 0 });
      }
      const entry = matchesByTier.get(m.tier_id)!;
      entry.total++;
      if (m.played_at) entry.played++;
    }

    tierProgress = (tiers ?? [])
      .filter((t) => matchesByTier.has(t.id))
      .map((t) => {
        const { played, total } = matchesByTier.get(t.id)!;
        return {
          tierId: t.id,
          tierNumber: t.tier_number,
          tierName: t.short_name || t.name,
          played,
          total,
        };
      });

    totalPlayed = tierProgress.reduce((s, t) => s + t.played, 0);
    totalMatches = tierProgress.reduce((s, t) => s + t.total, 0);
  }

  // Get current champions from latest completed season
  let champions: Array<{ tierName: string; holderName: string }> = [];
  const { data: lastCompleted } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "completed")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastCompleted) {
    const { data: finals } = await supabase
      .from("matches")
      .select("tier_id, winner_wrestler_id, winner_tag_team_id")
      .eq("season_id", lastCompleted.id)
      .eq("match_phase", "final")
      .not("played_at", "is", null);

    const { data: tierNames } = await supabase
      .from("tiers")
      .select("id, short_name, name, tier_number")
      .order("tier_number");

    const tierNameMap = Object.fromEntries(
      (tierNames ?? []).map((t) => [t.id, t.short_name || t.name])
    );

    champions = (finals ?? []).map((f) => ({
      tierName: tierNameMap[f.tier_id] ?? "?",
      holderName:
        wrestlerMap[f.winner_wrestler_id ?? ""] ??
        wrestlerMap[f.winner_tag_team_id ?? ""] ??
        "?",
    }));
  }

  const overallPct = totalMatches > 0 ? Math.round((totalPlayed / totalMatches) * 100) : 0;

  const stats = [
    {
      label: "Active Wrestlers",
      value: wrestlerCount ?? 0,
      color: "from-blue-500/10 to-blue-500/5",
      border: "border-blue-500/10 hover:border-blue-500/20",
    },
    {
      label: "Tag Teams",
      value: tagTeamCount ?? 0,
      color: "from-emerald-500/10 to-emerald-500/5",
      border: "border-emerald-500/10 hover:border-emerald-500/20",
    },
    {
      label: "Completed Seasons",
      value: completedSeasons ?? 0,
      color: "from-amber-500/10 to-amber-500/5",
      border: "border-amber-500/10 hover:border-amber-500/20",
    },
  ];

  const quickActions = [
    { href: "/season/setup", label: "Season Setup", icon: "⚙️" },
    { href: "/season/match", label: "Enter Match", primary: true, icon: "🎮" },
    { href: "/standings", label: "Standings", icon: "📊" },
    { href: "/season/playoffs", label: "Playoffs", icon: "🏆" },
    { href: "/season/relegation", label: "Relegation", icon: "↕️" },
  ];

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          <span className="gradient-text-gold">WWE 2K26</span>{" "}
          <span className="text-foreground">Simulation League</span>
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          CPU-vs-CPU championship simulation with tiered relegation
        </p>
      </div>

      {/* Stats + Season */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        {stats.map((stat) => (
          <Card key={stat.label} className={`card-hover bg-gradient-to-br ${stat.color} ${stat.border} transition-colors`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="card-hover bg-gradient-to-br from-gold/5 to-gold/0 border-gold/10 hover:border-gold/20 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Current Season
            </CardTitle>
          </CardHeader>
          <CardContent>
            {season ? (
              <div className="flex items-center gap-3">
                <p className="text-3xl font-bold tabular-nums">#{season.season_number}</p>
                <Badge className={`${getStatusColor(season.status)} text-xs`}>
                  {getStatusLabel(season.status)}
                </Badge>
              </div>
            ) : (
              <p className="text-3xl font-bold text-muted-foreground/50">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Season Progress */}
      {season && totalMatches > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Season Progress
            </h2>
            <span className="text-xs tabular-nums font-medium">
              {totalPlayed}/{totalMatches}
              <span className="text-muted-foreground/60 ml-1">({overallPct}%)</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted/20 overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tierProgress.map((t) => {
              const pct = t.total > 0 ? Math.round((t.played / t.total) * 100) : 0;
              return (
                <Link key={t.tierId} href={`/tiers/${t.tierId}`}>
                  <div className="flex items-center gap-2 rounded-md border border-border/20 px-3 py-1.5 hover:border-border/40 transition-colors">
                    <span className="font-mono text-[10px] text-muted-foreground/50 w-5">
                      T{t.tierNumber}
                    </span>
                    <span className="text-xs truncate flex-1">{t.tierName}</span>
                    <div className="w-16 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-gold/60"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground/50 w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Champions */}
      {champions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Current Champions
          </h2>
          <div className="flex flex-wrap gap-2">
            {champions.map((c, i) => (
              <Badge
                key={i}
                className="bg-gold/10 text-gold border-gold/20 text-xs gap-1 py-1"
              >
                🏆 {c.holderName}
                <span className="text-gold/50">·</span>
                <span className="text-gold/60">{c.tierName}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Button
                variant={action.primary ? "default" : "outline"}
                size="sm"
                className={
                  action.primary
                    ? "bg-gold text-black hover:bg-gold-dark font-semibold gap-1.5 shadow-md shadow-gold/10"
                    : "gap-1.5 border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                }
              >
                <span>{action.icon}</span>
                {action.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Results */}
      {recentMatches.length > 0 && (
        <div className="animate-slide-up">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent Results
          </h2>
          <div className="space-y-2">
            {recentMatches.map((m) => {
              const aId = m.wrestler_a_id || m.tag_team_a_id;
              const bId = m.wrestler_b_id || m.tag_team_b_id;
              const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
              const aName = wrestlerMap[aId ?? ""] ?? "?";
              const bName = wrestlerMap[bId ?? ""] ?? "?";
              const isAWinner = winnerId === aId;
              const time = m.match_time_seconds
                ? `${Math.floor(m.match_time_seconds / 60)}:${String(m.match_time_seconds % 60).padStart(2, "0")}`
                : null;
              return (
                <div
                  key={m.id}
                  className="group flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-4 py-3 text-sm transition-all hover:border-border/60 hover:bg-card"
                >
                  <span className={isAWinner ? "font-semibold text-gold" : "text-muted-foreground"}>
                    {aName}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    vs
                  </span>
                  <span className={!isAWinner ? "font-semibold text-gold" : "text-muted-foreground"}>
                    {bName}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {time && (
                      <span className="text-xs tabular-nums text-muted-foreground/50">
                        {time}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border/30">
                      {m.match_phase.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {recentMatches.length === 0 && !season && (
        <div className="rounded-xl border border-dashed border-border/40 bg-card/30 px-6 py-16 text-center animate-fade-in">
          <img
            src="/logo.svg"
            alt="WWE 2K26 Sim League"
            width={48}
            height={48}
            className="mx-auto mb-4 rounded-xl opacity-60"
          />
          <h3 className="text-lg font-semibold">Ready to Begin</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add wrestlers to the roster and set up your first season to get started.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/roster">
              <Button variant="outline" size="sm">Add Wrestlers</Button>
            </Link>
            <Link href="/season/setup">
              <Button size="sm" className="bg-gold text-black hover:bg-gold-dark">
                Setup Season 1
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
