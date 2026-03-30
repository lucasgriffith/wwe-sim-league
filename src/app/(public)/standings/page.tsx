import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Standing {
  id: string;
  name: string;
  wins: number;
  losses: number;
  winPct: number;
  totalTime: number;
  linkHref: string | null;
}

export default async function StandingsPage() {
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .in("status", ["pool_play", "playoffs", "relegation"])
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return (
      <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight">Standings</h1>
        <p className="mt-4 text-muted-foreground">
          No active season. Standings are available during pool play, playoffs, and relegation.
        </p>
      </div>
    );
  }

  const [
    { data: tiers },
    { data: assignments },
    { data: matches },
    { data: wrestlers },
    { data: tagTeams },
  ] = await Promise.all([
    supabase
      .from("tiers")
      .select("*, divisions(name, gender, division_type)")
      .order("tier_number"),
    supabase
      .from("tier_assignments")
      .select("tier_id, wrestler_id, tag_team_id, pool")
      .eq("season_id", season.id),
    supabase
      .from("matches")
      .select("tier_id, pool, wrestler_a_id, wrestler_b_id, tag_team_a_id, tag_team_b_id, winner_wrestler_id, winner_tag_team_id, match_time_seconds, match_phase")
      .eq("season_id", season.id)
      .eq("match_phase", "pool_play")
      .not("played_at", "is", null),
    supabase.from("wrestlers").select("id, name"),
    supabase.from("tag_teams").select("id, name"),
  ]);

  const wrestlerMap = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.name])
  );
  const tagTeamMap = Object.fromEntries(
    (tagTeams ?? []).map((t) => [t.id, t.name])
  );

  // Group tiers by division
  const divisions = new Map<string, typeof tiers>();
  for (const t of tiers ?? []) {
    const div = (t.divisions as { name: string })?.name ?? "Other";
    if (!divisions.has(div)) divisions.set(div, []);
    divisions.get(div)!.push(t);
  }

  function computeStandings(
    tierId: string,
    pool: string | null,
    isTag: boolean
  ): Standing[] {
    const tierAssigns = (assignments ?? []).filter(
      (a) => a.tier_id === tierId && (pool === null || a.pool === pool)
    );
    const tierMatches = (matches ?? []).filter(
      (m) => m.tier_id === tierId && (pool === null || m.pool === pool)
    );

    return tierAssigns
      .map((a) => {
        const pid = isTag ? a.tag_team_id! : a.wrestler_id!;
        const name = isTag ? tagTeamMap[pid] ?? "?" : wrestlerMap[pid] ?? "?";
        const pMatches = tierMatches.filter((m) =>
          isTag
            ? m.tag_team_a_id === pid || m.tag_team_b_id === pid
            : m.wrestler_a_id === pid || m.wrestler_b_id === pid
        );
        const wins = pMatches.filter((m) =>
          isTag ? m.winner_tag_team_id === pid : m.winner_wrestler_id === pid
        ).length;
        const losses = pMatches.length - wins;
        const winPct = pMatches.length > 0 ? wins / pMatches.length : 0;
        const totalTime = pMatches.reduce(
          (sum, m) => sum + (m.match_time_seconds ?? 0),
          0
        );
        return {
          id: pid,
          name,
          wins,
          losses,
          winPct,
          totalTime,
          linkHref: isTag ? null : `/roster/${pid}`,
        };
      })
      .sort((a, b) => b.winPct - a.winPct || a.totalTime - b.totalTime);
  }

  const divisionOrder = [
    "Men's Singles",
    "Women's Singles",
    "Men's Tag",
    "Women's Tag",
  ];

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Standings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Season {season.season_number} ·{" "}
          <Badge variant="outline" className="text-[10px]">
            {season.status.replace("_", " ")}
          </Badge>
        </p>
      </div>

      {/* Legend */}
      <div className="mb-8 flex flex-wrap items-center gap-4 rounded-lg border border-border/30 bg-card/30 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Legend</span>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gold/20 border border-gold/30" />
          <span className="text-[11px] text-muted-foreground">Playoff Zone (Top 2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500/10 border border-blue-500/20" />
          <span className="text-[11px] text-muted-foreground">Wild Card Contention (3rd)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/10 border border-amber-500/20" />
          <span className="text-[11px] text-muted-foreground">Relegation Playoff Zone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/10 border border-red-500/20" />
          <span className="text-[11px] text-muted-foreground">Auto-Relegation Zone (Bottom 2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[8px] border-emerald-500/30 text-emerald-400 px-1 py-0">✓</Badge>
          <span className="text-[11px] text-muted-foreground">Clinched Playoffs</span>
        </div>
      </div>

      <div className="space-y-10">
        {divisionOrder.map((divName) => {
          const divTiers = divisions.get(divName);
          if (!divTiers || divTiers.length === 0) return null;

          return (
            <div key={divName}>
              <h2 className="text-lg font-bold tracking-tight mb-4">{divName}</h2>
              <div className="space-y-6">
                {divTiers.map((tier) => {
                  const isTag = (tier.divisions as { division_type: string })?.division_type === "tag";
                  const hasPools = tier.has_pools;
                  const tierAssignCount = (assignments ?? []).filter(
                    (a) => a.tier_id === tier.id
                  ).length;
                  if (tierAssignCount === 0) return null;

                  return (
                    <div key={tier.id} className="rounded-lg border border-border/40 overflow-hidden">
                      <div className="bg-card/50 px-4 py-2.5 border-b border-border/30 flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          T{tier.tier_number}
                        </span>
                        <Link
                          href={`/tiers/${tier.id}`}
                          className="text-sm font-semibold hover:text-gold transition-colors"
                        >
                          {tier.short_name || tier.name}
                        </Link>
                      </div>

                      {hasPools ? (
                        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/30">
                          {(["A", "B"] as const).map((pool) => (
                            <StandingsTable
                              key={pool}
                              label={`Pool ${pool}`}
                              standings={computeStandings(tier.id, pool, isTag)}
                            />
                          ))}
                        </div>
                      ) : (
                        <StandingsTable
                          standings={computeStandings(tier.id, null, isTag)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StandingsTable({
  standings,
  label,
}: {
  standings: Standing[];
  label?: string;
}) {
  const count = standings.length;
  // Zone boundaries: top 2 = playoff, 3rd = wild card, bottom 2 = auto-relegate, 3rd/4th from bottom = relegation playoff
  const relegationPlayoffStart = Math.max(0, count - 4);
  const autoRelegateStart = Math.max(0, count - 2);

  return (
    <div>
      {label && (
        <div className="px-4 py-1.5 bg-muted/10">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 border-b border-border/20">
            <th className="px-3 py-2 text-left w-8">#</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-center w-8">W</th>
            <th className="px-3 py-2 text-center w-8">L</th>
            <th className="px-3 py-2 text-right w-14">Win%</th>
            <th className="px-3 py-2 text-right w-14 hidden sm:table-cell">Time</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            // Determine zone
            let rowBg = "";
            let zoneIndicator = "";
            if (i < 2) {
              rowBg = "bg-gold/[0.04] border-l-2 border-l-gold/30";
              zoneIndicator = "playoff";
            } else if (i === 2) {
              rowBg = "bg-blue-500/[0.03] border-l-2 border-l-blue-500/20";
              zoneIndicator = "wildcard";
            } else if (i >= autoRelegateStart && count > 4) {
              rowBg = "bg-red-500/[0.04] border-l-2 border-l-red-500/30";
              zoneIndicator = "auto-relegate";
            } else if (i >= relegationPlayoffStart && count > 4) {
              rowBg = "bg-amber-500/[0.03] border-l-2 border-l-amber-500/20";
              zoneIndicator = "relegation-playoff";
            }

            return (
              <tr
                key={s.id}
                className={`border-b border-border/10 text-sm ${rowBg}`}
              >
                <td className="px-3 py-2 tabular-nums text-xs text-muted-foreground">
                  {i + 1}
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    {s.linkHref ? (
                      <Link
                        href={s.linkHref}
                        className="font-medium hover:text-gold transition-colors"
                      >
                        {s.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{s.name}</span>
                    )}
                    {zoneIndicator === "playoff" && (
                      <Badge
                        variant="outline"
                        className="text-[8px] border-emerald-500/30 text-emerald-400 px-1 py-0"
                      >
                        ✓
                      </Badge>
                    )}
                    {zoneIndicator === "auto-relegate" && (
                      <span className="text-[8px] font-bold text-red-400/60">↓</span>
                    )}
                    {zoneIndicator === "relegation-playoff" && (
                      <span className="text-[8px] font-bold text-amber-400/60">⚔</span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 text-center tabular-nums font-medium text-emerald-400">
                  {s.wins}
                </td>
                <td className="px-3 py-2 text-center tabular-nums font-medium text-red-400">
                  {s.losses}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {s.wins + s.losses > 0
                    ? `${(s.winPct * 100).toFixed(0)}%`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground hidden sm:table-cell">
                  {s.totalTime > 0 ? formatTime(s.totalTime) : "—"}
                </td>
              </tr>
            );
          })}
          {standings.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matches played yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
