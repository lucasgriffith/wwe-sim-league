import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { StandingsClient } from "@/components/standings/standings-client";
import { computeStandings } from "@/lib/standings/compute-standings";
import { assignZones, type StandingZone } from "@/lib/standings/zones";
import {
  getActivePlaySeason,
  getChampions,
  getSeasonAssignments,
  getSeasonMatches,
  getTagTeams,
  getTiers,
  getWrestlers,
} from "@/lib/data/cached";

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
  zone: StandingZone;
  linkHref: string | null;
  imageUrl: string | null;
  memberImages?: [string | null, string | null];
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
  const season = await getActivePlaySeason();

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

  const [tiers, assignments, seasonMatches, wrestlers, tagTeams, champions] =
    await Promise.all([
      getTiers(),
      getSeasonAssignments(season.id),
      getSeasonMatches(season.id),
      getWrestlers(),
      getTagTeams(),
      getChampions(),
    ]);
  const matches = seasonMatches.filter((m) => m.match_phase === "pool_play");

  const wrestlerMap = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.name])
  );
  const wrestlerSlugMap = Object.fromEntries(
    (wrestlers ?? []).filter((w) => w.slug).map((w) => [w.id, w.slug])
  );
  const wrestlerImageMap = Object.fromEntries(
    (wrestlers ?? []).filter((w) => w.image_url).map((w) => [w.id, w.image_url])
  );
  const tagTeamMap = Object.fromEntries(
    (tagTeams ?? []).map((t) => [t.id, t.name])
  );
  const tagMemberImages: Record<string, [string | null, string | null]> = {};
  for (const t of tagTeams ?? []) {
    const wa = t.wrestler_a as unknown as { image_url: string | null } | null;
    const wb = t.wrestler_b as unknown as { image_url: string | null } | null;
    tagMemberImages[t.id] = [wa?.image_url ?? null, wb?.image_url ?? null];
  }

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
          zone: "safe" as StandingZone,
          linkHref: isTag ? `/tag-teams/${pid}` : `/roster/${wrestlerSlugMap[pid] ?? pid}`,
          imageUrl: isTag ? null : (wrestlerImageMap[pid] ?? null),
          ...(isTag && tagMemberImages[pid] ? { memberImages: tagMemberImages[pid] } : {}),
        };
      });

    // Compute GB from best record. The reference must be the row with the
    // best win-loss DIFFERENTIAL (games back is (leaderDiff - diff) / 2) —
    // picking by most wins alone made GB negative when e.g. a 1-0 row was
    // measured against a 2-2 "leader"
    const preSorted = [...rows].sort(
      (a, b) => b.wins - b.losses - (a.wins - a.losses)
    );
    const gbNums = new Map<string, number>();
    if (preSorted.length > 0) {
      const leader = preSorted[0];
      rows.forEach((r) => {
        const gb = ((leader.wins - r.wins) + (r.losses - leader.losses)) / 2;
        gbNums.set(r.id, gb);
        r.gb = gb === 0 ? "—" : gb.toFixed(1);
      });
    }

    // Order by the canonical standings comparator (same one playoff seeding
    // uses), so what's displayed always matches how seeds are computed
    const orderResults = tierMatches
      .filter((m) => (isTag ? m.winner_tag_team_id : m.winner_wrestler_id))
      .map((m) => ({
        id: `${m.tier_id}-${m.wrestler_a_id ?? m.tag_team_a_id}-${m.wrestler_b_id ?? m.tag_team_b_id}`,
        wrestlerAId: (isTag ? m.tag_team_a_id : m.wrestler_a_id)!,
        wrestlerBId: (isTag ? m.tag_team_b_id : m.wrestler_b_id)!,
        winnerId: (isTag ? m.winner_tag_team_id : m.winner_wrestler_id)!,
        matchTimeSeconds: m.match_time_seconds ?? 0,
      }));
    const canonical = computeStandings(
      rows.map((r) => ({ id: r.id, name: r.name })),
      orderResults
    );
    const rankOf = new Map(canonical.map((r) => [r.participantId, r.rank]));
    rows.sort((a, b) => (rankOf.get(a.id) ?? 999) - (rankOf.get(b.id) ?? 999));

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

    // Zones: playoff spots are per-pool, but wild cards and relegation are
    // tier-wide — compute the combined order and stamp each row
    const allRows = pools.flatMap((p) => p.standings);
    const tierPlayed = playedMatches.filter(
      (m) =>
        m.tier_id === t.id &&
        (isTag ? m.winner_tag_team_id : m.winner_wrestler_id)
    );
    const combined = computeStandings(
      allRows.map((r) => ({ id: r.id, name: r.name })),
      tierPlayed.map((m) => ({
        id: `${m.tier_id}-${m.wrestler_a_id ?? m.tag_team_a_id}`,
        wrestlerAId: (isTag ? m.tag_team_a_id : m.wrestler_a_id)!,
        wrestlerBId: (isTag ? m.tag_team_b_id : m.wrestler_b_id)!,
        winnerId: (isTag ? m.winner_tag_team_id : m.winner_wrestler_id)!,
        matchTimeSeconds: m.match_time_seconds ?? 0,
      }))
    );
    const zones = assignZones({
      poolRowIds: pools.map((p) => p.standings.map((r) => r.id)),
      combinedOrder: combined.map((c) => c.participantId),
      hasBracket: t.has_pools,
    });
    allRows.forEach((r) => {
      r.zone = zones.get(r.id) ?? "safe";
    });

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

      <StandingsClient divisions={divisions} champions={champions} />
    </div>
  );
}
