import { createClient } from "@/lib/supabase/server";
import { DynastyTabs } from "@/components/dynasty/dynasty-tabs";

export default async function DynastyPage() {
  const supabase = await createClient();

  const [
    { data: wrestlers },
    { data: tagTeams },
    { data: allMatches },
    { data: tierAssignments },
    { data: tiers },
    { data: seasons },
  ] = await Promise.all([
    supabase
      .from("wrestlers")
      .select("id, name, gender, overall_rating")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("tag_teams")
      .select(
        "id, name, is_active, wrestler_a:wrestlers!tag_teams_wrestler_a_id_fkey(id, name, gender), wrestler_b:wrestlers!tag_teams_wrestler_b_id_fkey(id, name, gender)"
      )
      .order("name"),
    supabase
      .from("matches")
      .select(
        "id, wrestler_a_id, wrestler_b_id, tag_team_a_id, tag_team_b_id, winner_wrestler_id, winner_tag_team_id, match_phase, tier_id, season_id, match_time_seconds"
      )
      .not("played_at", "is", null),
    supabase
      .from("tier_assignments")
      .select("wrestler_id, tag_team_id, tier_id, season_id")
      .order("created_at"),
    supabase
      .from("tiers")
      .select("id, name, short_name, tier_number, division_id, divisions(name, gender, division_type)")
      .order("tier_number"),
    supabase
      .from("seasons")
      .select("id, season_number, status")
      .order("season_number", { ascending: false }),
  ]);

  const tierMap = Object.fromEntries(
    (tiers ?? []).map((t) => [
      t.id,
      {
        name: t.name,
        shortName: t.short_name,
        tierNumber: t.tier_number,
        divisionName: (t.divisions as unknown as { name: string } | null)?.name ?? "",
        divisionType: (t.divisions as unknown as { division_type: string } | null)?.division_type ?? "singles",
      },
    ])
  );

  // Season lookup
  const seasonMap = Object.fromEntries(
    (seasons ?? []).map((s) => [s.id, s.season_number])
  );
  const latestCompletedSeason = (seasons ?? []).find(
    (s) => s.status === "completed"
  );
  const latestSeasonId = latestCompletedSeason?.id ?? null;
  const latestSeasonNumber = latestCompletedSeason?.season_number ?? null;

  // ── Wrestler stats ─────────────────────────────────────────────────
  const wrestlerStats = (wrestlers ?? []).map((w) => {
    const matches = (allMatches ?? []).filter(
      (m) => m.wrestler_a_id === w.id || m.wrestler_b_id === w.id
    );
    const wins = matches.filter((m) => m.winner_wrestler_id === w.id).length;
    const losses = matches.length - wins;
    const championships = matches.filter(
      (m) => m.match_phase === "final" && m.winner_wrestler_id === w.id
    ).length;
    const playoffMatches = matches.filter((m) =>
      ["quarterfinal", "semifinal", "final"].includes(m.match_phase)
    ).length;
    const finalsAppearances = matches.filter(
      (m) => m.match_phase === "final"
    ).length;

    const winTimes = matches
      .filter((m) => m.winner_wrestler_id === w.id && m.match_time_seconds)
      .map((m) => m.match_time_seconds!);
    const fastestWin = winTimes.length > 0 ? Math.min(...winTimes) : null;

    const allTimes = matches
      .filter((m) => m.match_time_seconds)
      .map((m) => m.match_time_seconds!);
    const avgMatchTime =
      allTimes.length > 0
        ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)
        : null;

    const wrestlerTiers = (tierAssignments ?? [])
      .filter((a) => a.wrestler_id === w.id)
      .map((a) => tierMap[a.tier_id]?.tierNumber ?? 999);
    const highestTier =
      wrestlerTiers.length > 0 ? Math.min(...wrestlerTiers) : null;

    const seasonIds = new Set(
      (tierAssignments ?? [])
        .filter((a) => a.wrestler_id === w.id)
        .map((a) => a.season_id)
    );

    const titles = matches
      .filter(
        (m) => m.match_phase === "final" && m.winner_wrestler_id === w.id
      )
      .map((m) => ({
        name: tierMap[m.tier_id]?.shortName || tierMap[m.tier_id]?.name || "Unknown",
        season: seasonMap[m.season_id] ?? 0,
        isCurrent: m.season_id === latestSeasonId,
      }));

    return {
      id: w.id,
      name: w.name,
      gender: w.gender as string,
      overallRating: w.overall_rating,
      wins,
      losses,
      winPct: matches.length > 0 ? wins / matches.length : 0,
      championships,
      titles,
      highestTier,
      totalMatches: matches.length,
      playoffMatches,
      finalsAppearances,
      fastestWin,
      avgMatchTime,
      seasons: seasonIds.size,
    };
  });

  wrestlerStats.sort(
    (a, b) =>
      b.championships - a.championships ||
      b.wins - a.wins ||
      b.winPct - a.winPct
  );

  // ── Tag team stats ─────────────────────────────────────────────────
  const tagTeamStats = (tagTeams ?? []).map((t) => {
    const wa = t.wrestler_a as unknown as { id: string; name: string; gender: string } | null;
    const wb = t.wrestler_b as unknown as { id: string; name: string; gender: string } | null;
    const teamGender =
      wa?.gender === wb?.gender
        ? wa?.gender === "male"
          ? "male"
          : "female"
        : "mixed";

    const matches = (allMatches ?? []).filter(
      (m) => m.tag_team_a_id === t.id || m.tag_team_b_id === t.id
    );
    const wins = matches.filter((m) => m.winner_tag_team_id === t.id).length;
    const losses = matches.length - wins;
    const championships = matches.filter(
      (m) => m.match_phase === "final" && m.winner_tag_team_id === t.id
    ).length;
    const playoffMatches = matches.filter((m) =>
      ["quarterfinal", "semifinal", "final"].includes(m.match_phase)
    ).length;
    const finalsAppearances = matches.filter(
      (m) => m.match_phase === "final"
    ).length;

    const winTimes = matches
      .filter((m) => m.winner_tag_team_id === t.id && m.match_time_seconds)
      .map((m) => m.match_time_seconds!);
    const fastestWin = winTimes.length > 0 ? Math.min(...winTimes) : null;

    const allTimes = matches
      .filter((m) => m.match_time_seconds)
      .map((m) => m.match_time_seconds!);
    const avgMatchTime =
      allTimes.length > 0
        ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)
        : null;

    const teamTiers = (tierAssignments ?? [])
      .filter((a) => a.tag_team_id === t.id)
      .map((a) => tierMap[a.tier_id]?.tierNumber ?? 999);
    const highestTier =
      teamTiers.length > 0 ? Math.min(...teamTiers) : null;

    const seasonIds = new Set(
      (tierAssignments ?? [])
        .filter((a) => a.tag_team_id === t.id)
        .map((a) => a.season_id)
    );

    const titles = matches
      .filter(
        (m) => m.match_phase === "final" && m.winner_tag_team_id === t.id
      )
      .map((m) => ({
        name: tierMap[m.tier_id]?.shortName || tierMap[m.tier_id]?.name || "Unknown",
        season: seasonMap[m.season_id] ?? 0,
        isCurrent: m.season_id === latestSeasonId,
      }));

    return {
      id: t.id,
      name: t.name,
      memberA: wa?.name ?? "?",
      memberB: wb?.name ?? "?",
      gender: teamGender,
      isActive: t.is_active,
      wins,
      losses,
      winPct: matches.length > 0 ? wins / matches.length : 0,
      championships,
      titles,
      highestTier,
      totalMatches: matches.length,
      playoffMatches,
      finalsAppearances,
      fastestWin,
      avgMatchTime,
      seasons: seasonIds.size,
    };
  });

  tagTeamStats.sort(
    (a, b) =>
      b.championships - a.championships ||
      b.wins - a.wins ||
      b.winPct - a.winPct
  );

  // Build current champions list from latest completed season finals
  const currentChampions: Array<{
    tierName: string;
    tierNumber: number;
    division: string;
    holderName: string;
    holderId: string;
    isTag: boolean;
  }> = [];

  if (latestSeasonId) {
    const finals = (allMatches ?? []).filter(
      (m) => m.match_phase === "final" && m.season_id === latestSeasonId
    );
    for (const f of finals) {
      const tier = tierMap[f.tier_id];
      if (!tier) continue;
      const winnerId = f.winner_wrestler_id || f.winner_tag_team_id;
      if (!winnerId) continue;
      const isTag = !!f.winner_tag_team_id;
      const holderName = isTag
        ? (tagTeams ?? []).find((t) => t.id === winnerId)
            ? ((tagTeams ?? []).find((t) => t.id === winnerId)!.wrestler_a as unknown as { name: string } | null)?.name
              ? (tagTeams ?? []).find((t) => t.id === winnerId)!.name
              : "Unknown"
            : "Unknown"
        : (wrestlers ?? []).find((w) => w.id === winnerId)?.name ?? "Unknown";

      currentChampions.push({
        tierName: tier.shortName || tier.name,
        tierNumber: tier.tierNumber,
        division: tier.divisionName,
        holderName,
        holderId: winnerId,
        isTag,
      });
    }
    currentChampions.sort((a, b) => a.tierNumber - b.tierNumber);
  }

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Dynasty Leaderboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All-time rankings across all seasons
        </p>
      </div>
      <DynastyTabs
        wrestlerStats={wrestlerStats}
        currentChampions={currentChampions}
        latestSeasonNumber={latestSeasonNumber}
        tagTeamStats={tagTeamStats}
      />
    </div>
  );
}
