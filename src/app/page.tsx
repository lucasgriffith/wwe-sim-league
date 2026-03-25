import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getStatusLabel, getStatusColor } from "@/lib/season/state-machine";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .neq("status", "completed")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

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

  let recentMatches: Array<{
    id: string;
    wrestler_a_id: string | null;
    wrestler_b_id: string | null;
    winner_wrestler_id: string | null;
    stipulation: string | null;
    match_phase: string;
    match_time_seconds: number | null;
  }> = [];

  if (season) {
    const { data } = await supabase
      .from("matches")
      .select("id, wrestler_a_id, wrestler_b_id, winner_wrestler_id, stipulation, match_phase, match_time_seconds")
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

  const stats = [
    {
      label: "Active Wrestlers",
      value: wrestlerCount ?? 0,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      color: "from-blue-500/10 to-blue-500/5",
      border: "border-blue-500/10 hover:border-blue-500/20",
    },
    {
      label: "Tag Teams",
      value: tagTeamCount ?? 0,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      color: "from-emerald-500/10 to-emerald-500/5",
      border: "border-emerald-500/10 hover:border-emerald-500/20",
    },
    {
      label: "Completed Seasons",
      value: completedSeasons ?? 0,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
      ),
      color: "from-amber-500/10 to-amber-500/5",
      border: "border-amber-500/10 hover:border-amber-500/20",
    },
  ];

  const quickActions = [
    { href: "/season/setup", label: "Season Setup", icon: "⚙️" },
    { href: "/season/match", label: "Enter Match", primary: true, icon: "🎮" },
    { href: "/season/playoffs", label: "Playoffs", icon: "🏆" },
    { href: "/season/relegation", label: "Relegation", icon: "↕️" },
    { href: "/rumble", label: "Royal Rumble", icon: "👑" },
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
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </CardTitle>
              {stat.icon}
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
              const aName = wrestlerMap[m.wrestler_a_id ?? ""] ?? "?";
              const bName = wrestlerMap[m.wrestler_b_id ?? ""] ?? "?";
              const isAWinner = m.winner_wrestler_id === m.wrestler_a_id;
              const time = m.match_time_seconds
                ? `${Math.floor(m.match_time_seconds / 60)}:${String(m.match_time_seconds % 60).padStart(2, "0")}`
                : null;
              return (
                <div
                  key={m.id}
                  className="group flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-4 py-3 text-sm transition-all hover:border-border/60 hover:bg-card"
                >
                  <span
                    className={
                      isAWinner
                        ? "font-semibold text-gold"
                        : "text-muted-foreground"
                    }
                  >
                    {aName}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    vs
                  </span>
                  <span
                    className={
                      !isAWinner
                        ? "font-semibold text-gold"
                        : "text-muted-foreground"
                    }
                  >
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

      {/* Empty state when no matches */}
      {recentMatches.length === 0 && !season && (
        <div className="rounded-xl border border-dashed border-border/40 bg-card/30 px-6 py-16 text-center animate-fade-in">
          <img
            src="/logo.png"
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
