import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { StandingsClient } from "@/components/standings/standings-client";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface Standing {
  id: string;
  name: string;
  wins: number;
  losses: number;
  winPct: number;
  avgTime: number;
  gb: string;
  streak: string;
  trend: boolean[];
  linkHref: string | null;
}

export interface TierStandings {
  tierId: string;
  tierSlug: string | null;
  tierNumber: number;
  tierName: string;
  tierShortName: string | null;
  divisionName: string;
  hasPools: boolean;
  isTag: boolean;
  pools: Array<{
    pool: string | null;
    standings: Standing[];
  }>;
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
          No active season.
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
      .select("tier_id, pool, wrestler_a_id, wrestler_b_id, tag_team_a_id, tag_team_b_id, winner_wrestler_id, winner_tag_team_id, match_time_seconds, match_phase, played_at")
      .eq("season_id", season.id)
      .eq("match_phase", "pool_play"),
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

  const playedMatches = (matches ?? []).filter((m) => m.played_at);

  // Build streak map from played matches (sorted by played_at)
  const matchesByParticipant = new Map<string, Array<{ winnerId: string | null; playedAt: string }>>();
  for (const m of playedMatches) {
    const aId = m.wrestler_a_id || m.tag_team_a_id;
    const bId = m.wrestler_b_id || m.tag_team_b_id;
    const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
    const entry = { winnerId, playedAt: m.played_at };
    if (aId) {
      if (!matchesByParticipant.has(aId)) matchesByParticipant.set(aId, []);
      matchesByParticipant.get(aId)!.push(entry);
    }
    if (bId) {
      if (!matchesByParticipant.has(bId)) matchesByParticipant.set(bId, []);
      matchesByParticipant.get(bId)!.push(entry);
    }
  }

  const streakMap = new Map<string, number>();
  for (const [id, pMatches] of matchesByParticipant) {
    const sorted = pMatches.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
    let streak = 0;
    if (sorted.length > 0) {
      const isFirstWin = sorted[0].winnerId === id;
      for (const m of sorted) {
        if (isFirstWin && m.winnerId === id) streak++;
        else if (!isFirstWin && m.winnerId !== id) streak--;
        else break;
      }
    }
    streakMap.set(id, streak);
  }

  function computeStandingsForPool(
    tierId: string,
    pool: string | null,
    isTag: boolean
  ): Standing[] {
    const tierAssigns = (assignments ?? []).filter(
      (a) => a.tier_id === tierId && (pool === null || a.pool === pool)
    );
    const tierMatches = playedMatches.filter(
      (m) => m.tier_id === tierId && (pool === null || m.pool === pool)
    );

    const rows = tierAssigns
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
        const s = streakMap.get(pid) ?? 0;
        const streak = s > 0 ? `W${s}` : s < 0 ? `L${Math.abs(s)}` : "—";

        // Compute trend (last 10 results, chronological order)
        const sortedDesc = [...pMatches]
          .filter((m) => m.played_at)
          .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
        const trend = sortedDesc
          .slice(0, 10)
          .reverse()
          .map((m) => {
            const winnerId = isTag ? m.winner_tag_team_id : m.winner_wrestler_id;
            return winnerId === pid;
          });

        return {
          id: pid,
          name,
          wins,
          losses,
          winPct,
          avgTime,
          gb: "",
          streak,
          trend,
          linkHref: isTag ? "/tag-teams" : `/roster/${wrestlerSlugMap[pid] ?? pid}`,
        };
      });

    // Compute GB from best record
    const preSorted = [...rows].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    });
    const gbNums = new Map<string, number>();
    if (preSorted.length > 0) {
      const leader = preSorted[0];
      rows.forEach((r) => {
        const gb = ((leader.wins - r.wins) + (r.losses - leader.losses)) / 2;
        gbNums.set(r.id, gb);
        r.gb = gb === 0 ? "—" : gb.toFixed(1);
      });
    }

    // Sort by GB first, then win%, then avg time tiebreak
    rows.sort((a, b) => {
      const gbA = gbNums.get(a.id) ?? 999;
      const gbB = gbNums.get(b.id) ?? 999;
      if (gbA !== gbB) return gbA - gbB;
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      if (a.avgTime && b.avgTime) {
        if (a.winPct >= 0.5 && b.winPct >= 0.5) return a.avgTime - b.avgTime;
        if (a.winPct < 0.5 && b.winPct < 0.5) return b.avgTime - a.avgTime;
      }
      return 0;
    });

    return rows;
  }

  // Build all tier standings grouped by division
  const divisionOrder = [
    "Men's Singles",
    "Women's Singles",
    "Men's Tag Teams",
    "Women's Tag Teams",
  ];

  const allTierStandings: TierStandings[] = [];

  for (const t of tiers ?? []) {
    const div = (t.divisions as { name: string; division_type: string }) ?? { name: "Other", division_type: "singles" };
    const isTag = div.division_type === "tag";
    const tierAssignCount = (assignments ?? []).filter((a) => a.tier_id === t.id).length;
    if (tierAssignCount === 0) continue;

    const pools = t.has_pools
      ? (["A", "B"] as const).map((pool) => ({
          pool: pool as string | null,
          standings: computeStandingsForPool(t.id, pool, isTag),
        }))
      : [{ pool: null, standings: computeStandingsForPool(t.id, null, isTag) }];

    allTierStandings.push({
      tierId: t.id,
      tierSlug: t.slug ?? null,
      tierNumber: t.tier_number,
      tierName: t.name,
      tierShortName: t.short_name,
      divisionName: div.name,
      hasPools: t.has_pools,
      isTag,
      pools,
    });
  }

  const divisions = divisionOrder
    .map((name) => ({
      name,
      tiers: allTierStandings.filter((t) => t.divisionName === name),
    }))
    .filter((d) => d.tiers.length > 0);

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

      <StandingsClient divisions={divisions} />
    </div>
  );
}
