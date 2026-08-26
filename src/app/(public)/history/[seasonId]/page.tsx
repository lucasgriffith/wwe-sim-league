import { notFound } from "next/navigation";
import {
  getAllAssignments,
  getAllMatches,
  getSeasonById,
  getSeasonRelegationEvents,
  getTagTeams,
  getTiers,
  getWrestlers,
} from "@/lib/data/cached";
import { generateRecapSections } from "@/lib/recap/generate-recap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const { seasonId } = await params;

  const [season, allMatchRows, wrestlers, tagTeams, relegationEvents, tiers, allAssignments] =
    await Promise.all([
      getSeasonById(seasonId),
      getAllMatches(),
      getWrestlers(),
      getTagTeams(),
      getSeasonRelegationEvents(seasonId),
      getTiers(),
      getAllAssignments(),
    ]);

  if (!season) notFound();

  const finals = allMatchRows.filter(
    (m) =>
      m.season_id === seasonId && m.match_phase === "final" && m.played_at
  );

  const wrestlerMap = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.name])
  );
  const tagTeamMap = Object.fromEntries(
    (tagTeams ?? []).map((t) => [t.id, t.name])
  );

  function getWinnerName(m: NonNullable<typeof finals>[0]): string {
    if (m.winner_wrestler_id) return wrestlerMap[m.winner_wrestler_id] ?? "?";
    if (m.winner_tag_team_id) return tagTeamMap[m.winner_tag_team_id] ?? "?";
    return "?";
  }

  // ── Season recap ──────────────────────────────────────────────────────────
  const nameOf = (id: string | null) =>
    (id && (wrestlerMap[id] ?? tagTeamMap[id])) || "?";
  const seasonPlayed = allMatchRows.filter(
    (m) =>
      m.season_id === seasonId &&
      m.played_at &&
      (m.winner_wrestler_id || m.winner_tag_team_id)
  );
  const tierNumberOf = new Map(tiers.map((t) => [t.id, t.tier_number]));

  // Per-participant pool-play records for MVP / best record / most matches
  const records = new Map<string, { wins: number; losses: number }>();
  for (const m of seasonPlayed.filter((x) => x.match_phase === "pool_play")) {
    const winner = (m.winner_wrestler_id || m.winner_tag_team_id)!;
    const a = (m.wrestler_a_id || m.tag_team_a_id)!;
    const b = (m.wrestler_b_id || m.tag_team_b_id)!;
    const loser = winner === a ? b : a;
    if (!records.has(winner)) records.set(winner, { wins: 0, losses: 0 });
    if (!records.has(loser)) records.set(loser, { wins: 0, losses: 0 });
    records.get(winner)!.wins++;
    records.get(loser)!.losses++;
  }
  const rankedRecords = [...records.entries()]
    .map(([id, r]) => ({
      id,
      ...r,
      total: r.wins + r.losses,
      winPct: r.wins + r.losses > 0 ? r.wins / (r.wins + r.losses) : 0,
    }))
    .filter((r) => r.total >= 3)
    .sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);
  const mvpEntry = rankedRecords[0] ?? null;
  const mvpAssignment = mvpEntry
    ? allAssignments.find(
        (a) =>
          a.season_id === seasonId &&
          (a.wrestler_id === mvpEntry.id || a.tag_team_id === mvpEntry.id)
      )
    : null;

  const timedMatches = seasonPlayed.filter((m) => (m.match_time_seconds ?? 0) > 0);
  const toRecordMatch = (m: (typeof timedMatches)[0]) => {
    const winner = (m.winner_wrestler_id || m.winner_tag_team_id)!;
    const a = (m.wrestler_a_id || m.tag_team_a_id)!;
    const b = (m.wrestler_b_id || m.tag_team_b_id)!;
    return {
      time: m.match_time_seconds!,
      winnerName: nameOf(winner),
      loserName: nameOf(winner === a ? b : a),
      tierName: m.tiers?.short_name || m.tiers?.name || "?",
    };
  };
  const fastest = timedMatches.length
    ? toRecordMatch(timedMatches.reduce((min, m) => (m.match_time_seconds! < min.match_time_seconds! ? m : min)))
    : null;
  const longest = timedMatches.length
    ? toRecordMatch(timedMatches.reduce((max, m) => (m.match_time_seconds! > max.match_time_seconds! ? m : max)))
    : null;
  const mostMatchesEntry = [...records.entries()].sort(
    (a, b) => b[1].wins + b[1].losses - (a[1].wins + a[1].losses)
  )[0];

  const recapSections = generateRecapSections({
    seasonNumber: season.season_number,
    champions: finals.map((f) => {
      const winner = (f.winner_wrestler_id || f.winner_tag_team_id)!;
      const a = (f.wrestler_a_id || f.tag_team_a_id)!;
      const b = (f.wrestler_b_id || f.tag_team_b_id)!;
      return {
        tierName: f.tiers?.short_name || f.tiers?.name || "?",
        tierNumber: f.tiers?.tier_number ?? 99,
        divisionName: f.tiers?.divisions?.name ?? "",
        winnerName: nameOf(winner),
        runnerUpName: nameOf(winner === a ? b : a),
        finalStipulation: f.stipulation,
        finalTime: f.match_time_seconds,
      };
    }),
    mvp: mvpEntry
      ? {
          name: nameOf(mvpEntry.id),
          wins: mvpEntry.wins,
          losses: mvpEntry.losses,
          winPct: mvpEntry.winPct,
          tierName:
            mvpAssignment?.tiers?.short_name || mvpAssignment?.tiers?.name || "their tier",
        }
      : null,
    records: {
      fastestMatch: fastest,
      longestMatch: longest,
      bestRecord: mvpEntry
        ? { name: nameOf(mvpEntry.id), wins: mvpEntry.wins, losses: mvpEntry.losses, winPct: mvpEntry.winPct }
        : null,
      mostMatches: mostMatchesEntry
        ? { name: nameOf(mostMatchesEntry[0]), count: mostMatchesEntry[1].wins + mostMatchesEntry[1].losses }
        : null,
    },
    totalMatches: seasonPlayed.length,
    biggestMovers: relegationEvents
      .filter((e) => e.from_tier_id && e.to_tier_id)
      .map((e) => {
        const from = tierNumberOf.get(e.from_tier_id!) ?? 0;
        const to = tierNumberOf.get(e.to_tier_id!) ?? 0;
        return {
          name: nameOf(e.wrestler_id || e.tag_team_id),
          fromTier: from,
          toTier: to,
          direction: (to < from ? "up" : "down") as "up" | "down",
          change: Math.abs(from - to),
        };
      })
      .sort((a, b) => b.change - a.change),
  });

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <Link
        href="/history"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to History
      </Link>

      <div className="mt-6 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Season {season.season_number}
        </h1>
        {season.started_at && (
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(season.started_at).toLocaleDateString()} —{" "}
            {season.completed_at ? new Date(season.completed_at).toLocaleDateString() : ""}
          </p>
        )}
      </div>

      {/* Season Recap */}
      {recapSections.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Season Recap
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 stagger-children">
            {recapSections.map((section) => (
              <Card key={section.title} className="border-border/40 bg-card/50">
                <CardContent className="py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {section.emoji} {section.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed">{section.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Champions */}
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Champions
      </h2>
      {(finals ?? []).length > 0 ? (
        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
          {(finals ?? [])
            .sort(
              (a, b) =>
                ((a.tiers as { tier_number: number })?.tier_number ?? 0) -
                ((b.tiers as { tier_number: number })?.tier_number ?? 0)
            )
            .map((final) => {
              const tier = final.tiers as {
                name: string;
                short_name: string;
                tier_number: number;
                divisions: { name: string };
              };
              return (
                <Card key={final.id} className="card-hover border-border/40 bg-gradient-to-br from-gold/5 to-transparent">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider text-gold border-gold/20">
                        T{tier?.tier_number}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground/60">
                        {tier?.divisions?.name}
                      </span>
                    </div>
                    <CardTitle className="text-sm mt-1">{tier?.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base font-bold gradient-text-gold">
                      {getWinnerName(final)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      ) : (
        <p className="mb-10 text-sm text-muted-foreground">No champion data available.</p>
      )}

      {/* Relegation movements */}
      {relegationEvents && relegationEvents.length > 0 && (
        <div className="animate-slide-up">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Relegation Movement
          </h2>
          <div className="space-y-2">
            {relegationEvents.map((evt) => {
              const name = evt.wrestler_id
                ? wrestlerMap[evt.wrestler_id] ?? "?"
                : evt.tag_team_id
                ? tagTeamMap[evt.tag_team_id] ?? "?"
                : "?";
              const isUp = evt.movement_type.includes("promote") || evt.movement_type === "playoff_survive";
              return (
                <div key={evt.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-4 py-3 text-sm">
                  <span className={`text-lg ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                    {isUp ? "↑" : "↓"}
                  </span>
                  <span className="font-medium">{name}</span>
                  <Badge variant="outline" className={`text-[10px] ml-auto ${
                    isUp ? "border-emerald-500/20 text-emerald-400" : "border-red-500/20 text-red-400"
                  }`}>
                    {evt.movement_type.replace(/_/g, " ")}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
