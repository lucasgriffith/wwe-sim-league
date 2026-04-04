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
  avgTime: number;
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
    supabase.from("wrestlers").select("id, name, slug"),
    supabase.from("tag_teams").select("id, name"),
  ]);

  const wrestlerMap = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.name])
  );
  const wrestlerSlugMap = Object.fromEntries(
    (wrestlers ?? []).filter((w) => w.slug).map((w) => [w.id, w.slug])
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
        const avgTime = pMatches.length > 0 ? Math.round(totalTime / pMatches.length) : 0;
        return {
          id: pid,
          name,
          wins,
          losses,
          winPct,
          totalTime,
          avgTime,
          linkHref: isTag ? null : `/roster/${wrestlerSlugMap[pid] ?? pid}`,
        };
      })
      .sort((a, b) => {
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.avgTime && b.avgTime) {
          if (a.winPct >= 0.5 && b.winPct >= 0.5) return a.avgTime - b.avgTime;
          if (a.winPct < 0.5 && b.winPct < 0.5) return b.avgTime - a.avgTime;
        }
        return 0;
      });
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
      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border/30 bg-card/30 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Legend</span>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/20 border-2 border-emerald-500/50" />
          <span className="text-[11px] text-muted-foreground">Playoff Zone (Top 2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500/15 border-2 border-blue-500/40" />
          <span className="text-[11px] text-muted-foreground">Wild Card Contention (3rd)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500/15 border-2 border-orange-500/40" />
          <span className="text-[11px] text-muted-foreground">Relegation Playoff ⚔</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/20 border-2 border-red-500/50" />
          <span className="text-[11px] text-muted-foreground">Auto-Relegation ↓ (Bottom 2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[8px] border-emerald-500/30 text-emerald-400 px-1 py-0">✓</Badge>
          <span className="text-[11px] text-muted-foreground">Clinched Playoffs (mathematically guaranteed)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[8px] border-muted-foreground/20 text-muted-foreground/40 px-1 py-0">✗</Badge>
          <span className="text-[11px] text-muted-foreground">Eliminated from Playoffs</span>
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
                          href={`/tiers/${tier.slug}`}
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
  totalPoolMatches,
}: {
  standings: Standing[];
  label?: string;
  totalPoolMatches?: number;
}) {
  const count = standings.length;
  // Zone boundaries
  const relegationPlayoffStart = Math.max(0, count - 4);
  const autoRelegateStart = Math.max(0, count - 2);

  // Calculate total rounds in a round-robin: each wrestler plays (count - 1) matches
  const totalRounds = count > 1 ? count - 1 : 0;

  // Mathematical clinch: a wrestler has clinched if even assuming they lose all
  // remaining matches, no one below them can overtake them for the playoff spots.
  // Simple conservative check: clinched if their current wins > what 3rd place could
  // maximally achieve (3rd place's wins + their remaining matches).
  function hasClinched(idx: number): boolean {
    if (idx >= 2) return false; // only top 2 can clinch
    if (count < 3) return standings[idx].wins > 0; // trivially clinched with 2 or fewer
    const myWins = standings[idx].wins;
    const gamesPlayed = standings[idx].wins + standings[idx].losses;
    const remaining = totalRounds - gamesPlayed;
    // The wrestler at position idx has at minimum (myWins + 0) if they lose everything
    const myWorstCase = myWins;
    // The best the 3rd place (or anyone below 2nd) could do
    let maxRivalBest = 0;
    for (let j = 2; j < count; j++) {
      const rivalPlayed = standings[j].wins + standings[j].losses;
      const rivalRemaining = totalRounds - rivalPlayed;
      const rivalBest = standings[j].wins + rivalRemaining;
      maxRivalBest = Math.max(maxRivalBest, rivalBest);
    }
    return myWorstCase > maxRivalBest;
  }

  // Mathematical elimination from playoffs: if even winning all remaining matches
  // can't get you into top 2
  function isEliminated(idx: number): boolean {
    if (idx < 2) return false;
    const gamesPlayed = standings[idx].wins + standings[idx].losses;
    const remaining = totalRounds - gamesPlayed;
    const myBestCase = standings[idx].wins + remaining;
    // If my best case is less than what the current 2nd place already has, eliminated
    if (count >= 2 && myBestCase < standings[1].wins) return true;
    return false;
  }

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
            <th className="px-3 py-2 text-right w-14 hidden sm:table-cell">Avg Time</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            // Determine zone
            let rowBg = "";
            let zoneIndicator = "";
            if (i < 2) {
              rowBg = "bg-emerald-500/[0.08] border-l-[3px] border-l-emerald-500/50";
              zoneIndicator = "playoff";
            } else if (i === 2) {
              rowBg = "bg-blue-500/[0.06] border-l-[3px] border-l-blue-500/40";
              zoneIndicator = "wildcard";
            } else if (i >= autoRelegateStart && count > 4) {
              rowBg = "bg-red-500/[0.08] border-l-[3px] border-l-red-500/50";
              zoneIndicator = "auto-relegate";
            } else if (i >= relegationPlayoffStart && count > 4) {
              rowBg = "bg-orange-500/[0.06] border-l-[3px] border-l-orange-500/40";
              zoneIndicator = "relegation-playoff";
            }

            const clinched = hasClinched(i);
            const eliminated = isEliminated(i);

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
                        className={`font-medium hover:text-gold transition-colors ${eliminated ? "text-muted-foreground/50" : ""}`}
                      >
                        {s.name}
                      </Link>
                    ) : (
                      <span className={`font-medium ${eliminated ? "text-muted-foreground/50" : ""}`}>{s.name}</span>
                    )}
                    {clinched && (
                      <Badge
                        variant="outline"
                        className="text-[8px] border-emerald-500/30 text-emerald-400 px-1 py-0"
                      >
                        ✓
                      </Badge>
                    )}
                    {eliminated && (
                      <Badge
                        variant="outline"
                        className="text-[8px] border-muted-foreground/20 text-muted-foreground/40 px-1 py-0"
                      >
                        ✗
                      </Badge>
                    )}
                    {zoneIndicator === "auto-relegate" && (
                      <span className="text-[8px] font-bold text-red-400/60">↓</span>
                    )}
                    {zoneIndicator === "relegation-playoff" && (
                      <span className="text-[8px] font-bold text-orange-400/60">⚔</span>
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
                  {s.avgTime > 0 ? formatTime(s.avgTime) : "—"}
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
