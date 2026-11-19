import { computeRaces } from "@/lib/standings/races";
import { tierColor } from "@/lib/tiers/colors";
import {
  getCurrentSeason,
  getCompletedSeasons,
  getWrestlers,
  getTagTeams,
  getTiers,
  getSeasonMatches,
  getSeasonAssignments,
  getAllMatches,
} from "@/lib/data/cached";
import { buildEloBoard } from "@/lib/elo/board";
import { EloMoveChip } from "@/components/ui/elo-move";
import { RankBadge } from "@/components/ui/rank-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getStatusLabel, getStatusColor } from "@/lib/season/state-machine";
import { UpNextCard } from "@/components/dashboard/up-next-card";
import { SeasonTicker } from "@/components/dashboard/season-ticker";
import { MilestonesBanner } from "@/components/dashboard/milestones";
import { UndoMatchButton } from "@/components/dashboard/undo-match-button";
import { computeMilestones } from "@/lib/milestones";
import { LiveFeed } from "@/components/dashboard/live-feed";
import { SmartImage } from "@/components/ui/smart-image";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const [season, completedSeasonList, wrestlers, allTagTeams, careerMatches] =
    await Promise.all([
      getCurrentSeason(),
      getCompletedSeasons(),
      getWrestlers(),
      getTagTeams(),
      getAllMatches(),
    ]);

  // Career Elo across all seasons — powers the rankings below
  const eloBoard = buildEloBoard(careerMatches, wrestlers, allTagTeams);

  const wrestlerCount = wrestlers.filter((w) => w.is_active).length;
  const tagTeamCount = allTagTeams.filter((t) => t.is_active).length;
  const completedSeasons = completedSeasonList.length;

  const wrestlerMap = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.name])
  );
  const imageMap = Object.fromEntries(
    (wrestlers ?? []).filter((w) => w.image_url).map((w) => [w.id, w.image_url!])
  );
  const ratingMap = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.overall_rating ?? null])
  );
  const slugMap = Object.fromEntries(
    (wrestlers ?? []).filter((w) => w.slug).map((w) => [w.id, w.slug!])
  );
  const genderMap = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.gender ?? "male"])
  );

  // ── Season-specific data ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allMatchData: any[] = [];
  let tagMemberImages: Record<string, [string | null, string | null]> = {};
  let tagGenderMap: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tierAssignmentsData: any[] = [];
  let tierProgress: Array<{
    tierId: string;
    tierSlug: string | null;
    tierNumber: number;
    tierName: string;
    tierColor: string | null;
    divisionName: string;
    played: number;
    total: number;
  }> = [];
  let totalPlayed = 0;
  let totalMatches = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tiersData: any[] = [];

  if (season) {
    const [seasonMatches, tiers, tierAssignments] = await Promise.all([
      getSeasonMatches(season.id),
      getTiers(),
      getSeasonAssignments(season.id),
    ]);

    // Match the old query's ordering: played_at desc, nulls (unplayed) first
    allMatchData = [...seasonMatches].sort((a, b) => {
      if (!a.played_at && !b.played_at) return 0;
      if (!a.played_at) return -1;
      if (!b.played_at) return 1;
      return new Date(b.played_at).getTime() - new Date(a.played_at).getTime();
    });
    tiersData = tiers;
    tierAssignmentsData = tierAssignments;

    for (const t of allTagTeams) {
      wrestlerMap[t.id] = t.name;
      const wa = t.wrestler_a as unknown as { image_url: string | null; gender: string | null } | null;
      const wb = t.wrestler_b as unknown as { image_url: string | null; gender: string | null } | null;
      tagMemberImages[t.id] = [wa?.image_url ?? null, wb?.image_url ?? null];
      // Determine tag team gender from members (use wrestler_a's gender)
      tagGenderMap[t.id] = wa?.gender ?? "male";
    }

    const matchesByTier = new Map<string, { played: number; total: number }>();
    for (const m of allMatchData) {
      if (!matchesByTier.has(m.tier_id)) {
        matchesByTier.set(m.tier_id, { played: 0, total: 0 });
      }
      const entry = matchesByTier.get(m.tier_id)!;
      entry.total++;
      if (m.played_at) entry.played++;
    }

    tierProgress = tiers
      .filter((t) => matchesByTier.has(t.id))
      .map((t) => {
        const { played, total } = matchesByTier.get(t.id)!;
        const div = t.divisions as unknown as { name: string; gender: string } | null;
        return {
          tierId: t.id,
          tierSlug: t.slug ?? null,
          tierNumber: t.tier_number,
          tierName: t.short_name || t.name,
          tierColor: t.color,
          divisionName: div?.name ?? "",
          played,
          total,
        };
      });

    totalPlayed = tierProgress.reduce((s, t) => s + t.played, 0);
    totalMatches = tierProgress.reduce((s, t) => s + t.total, 0);
  }

  // ── Champions ─────────────────────────────────────────────────────────────
  let champions: Array<{
    tierName: string;
    tierNumber: number;
    holderName: string;
    holderId: string;
    beltImageUrl: string | null;
  }> = [];

  const lastCompleted = completedSeasonList[0];

  if (lastCompleted) {
    const [lastSeasonMatches, tierNames] = await Promise.all([
      getSeasonMatches(lastCompleted.id),
      getTiers(),
    ]);
    const finals = lastSeasonMatches.filter(
      (m) => m.match_phase === "final" && m.played_at
    );

    champions = finals.map((f) => {
      const tier = tierNames.find((t) => t.id === f.tier_id);
      const holderId = f.winner_wrestler_id ?? f.winner_tag_team_id ?? "";
      return {
        tierName: tier?.short_name || tier?.name || "?",
        tierNumber: tier?.tier_number ?? 99,
        holderName: wrestlerMap[holderId] ?? "?",
        holderId,
        beltImageUrl: tier?.belt_image_url ?? null,
      };
    });
  }

  // ── Compute "On Fire" wrestlers ───────────────────────────────────────────
  const playedMatches = allMatchData.filter((m) => m.played_at);
  const winStreaks = new Map<string, number>();
  const winCounts = new Map<string, number>();
  const lossCounts = new Map<string, number>();

  // Count wins/losses per participant
  for (const m of playedMatches) {
    const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
    const aId = m.wrestler_a_id || m.tag_team_a_id;
    const bId = m.wrestler_b_id || m.tag_team_b_id;
    const loserId = winnerId === aId ? bId : aId;

    if (winnerId) winCounts.set(winnerId, (winCounts.get(winnerId) ?? 0) + 1);
    if (loserId) lossCounts.set(loserId, (lossCounts.get(loserId) ?? 0) + 1);
  }

  // Compute win streaks (sort by most recent)
  const matchesByParticipant = new Map<string, typeof playedMatches>();
  for (const m of playedMatches) {
    const aId = m.wrestler_a_id || m.tag_team_a_id;
    const bId = m.wrestler_b_id || m.tag_team_b_id;
    if (aId) {
      if (!matchesByParticipant.has(aId)) matchesByParticipant.set(aId, []);
      matchesByParticipant.get(aId)!.push(m);
    }
    if (bId) {
      if (!matchesByParticipant.has(bId)) matchesByParticipant.set(bId, []);
      matchesByParticipant.get(bId)!.push(m);
    }
  }

  for (const [id, matches] of matchesByParticipant) {
    const sorted = matches.sort(
      (a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
    );
    let streak = 0;
    for (const m of sorted) {
      const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
      if (winnerId === id) streak++;
      else break;
    }
    if (streak >= 2) winStreaks.set(id, streak);
  }

  // Compute full streaks (positive = wins, negative = losses)
  const fullStreaks = new Map<string, number>();
  for (const [id, pMatches] of matchesByParticipant) {
    const sorted = pMatches.sort(
      (a: { played_at: string }, b: { played_at: string }) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
    );
    let streak = 0;
    if (sorted.length > 0) {
      const firstWinnerId = sorted[0].winner_wrestler_id || sorted[0].winner_tag_team_id;
      const isWin = firstWinnerId === id;
      for (const m of sorted) {
        const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
        if (isWin && winnerId === id) streak++;
        else if (!isWin && winnerId !== id) streak--;
        else break;
      }
    }
    fullStreaks.set(id, streak);
  }

  const onFire = Array.from(winStreaks.entries())
    .map(([id, streak]) => ({
      id,
      slug: slugMap[id] ?? null,
      name: wrestlerMap[id] ?? "Unknown",
      image: imageMap[id] ?? null,
      streak,
      wins: winCounts.get(id) ?? 0,
      losses: lossCounts.get(id) ?? 0,
    }))
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 8);

  // Ice Cold: wrestlers on losing streaks (2+)
  const iceCold = Array.from(fullStreaks.entries())
    .filter(([, streak]) => streak <= -2)
    .map(([id, streak]) => ({
      id,
      slug: slugMap[id] ?? null,
      name: wrestlerMap[id] ?? "Unknown",
      image: imageMap[id] ?? null,
      streak, // negative number
      wins: winCounts.get(id) ?? 0,
      losses: lossCounts.get(id) ?? 0,
    }))
    .sort((a, b) => a.streak - b.streak) // most losses first
    .slice(0, 8);

  // ── Featured Match (most recent) ──────────────────────────────────────────
  const featuredMatch = playedMatches[0] ?? null;

  // ── Upcoming matches for random picker ───────────────────────────────────
  const unplayedMatches = allMatchData
    .filter((m: { played_at: string | null; match_phase: string }) => !m.played_at && m.match_phase === "pool_play")
    .map((m: { id: string; tier_id: string; pool: string | null; wrestler_a_id: string | null; wrestler_b_id: string | null; tag_team_a_id: string | null; tag_team_b_id: string | null }) => ({
      id: m.id,
      tier_id: m.tier_id,
      pool: m.pool,
      wrestler_a_id: m.wrestler_a_id,
      wrestler_b_id: m.wrestler_b_id,
      tag_team_a_id: m.tag_team_a_id,
      tag_team_b_id: m.tag_team_b_id,
    }));

  // Build participant stats map for Up Next card
  const upNextParticipantStats: Record<string, {
    name: string;
    slug?: string | null;
    image: string | null;
    memberImages?: [string | null, string | null];
    wins: number;
    losses: number;
    overallRating: number | null;
    streak: number;
    poolRank?: string | null;
    elo?: number | null;
    eloRank?: number | null;
  }> = {};
  const allParticipantIds = new Set<string>();
  for (const m of unplayedMatches) {
    const aId = m.wrestler_a_id || m.tag_team_a_id;
    const bId = m.wrestler_b_id || m.tag_team_b_id;
    if (aId) allParticipantIds.add(aId);
    if (bId) allParticipantIds.add(bId);
  }
  // Compute pool rankings for each participant
  const poolRankMap = new Map<string, string>();
  if (tierAssignmentsData.length > 0) {
    // Group assignments by tier+pool
    const groups = new Map<string, Array<{ id: string }>>();
    for (const a of tierAssignmentsData) {
      const pid = a.wrestler_id || a.tag_team_id;
      if (!pid) continue;
      const key = `${a.tier_id}|${a.pool ?? "all"}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ id: pid });
    }
    // Sort each group by wins desc, compute rank
    for (const [, members] of groups) {
      const sorted = [...members].sort((a, b) => {
        const aW = winCounts.get(a.id) ?? 0;
        const bW = winCounts.get(b.id) ?? 0;
        const aL = lossCounts.get(a.id) ?? 0;
        const bL = lossCounts.get(b.id) ?? 0;
        const aGb = ((bW - aW) + (aL - bL)) / 2;
        return aGb;
      });
      sorted.forEach((m, idx) => {
        const ordinal = idx === 0 ? "1st" : idx === 1 ? "2nd" : idx === 2 ? "3rd" : `${idx + 1}th`;
        poolRankMap.set(m.id, ordinal);
      });
    }
  }

  for (const id of allParticipantIds) {
    const isTagTeam = !!(tagMemberImages ?? {})[id];
    upNextParticipantStats[id] = {
      name: wrestlerMap[id] ?? "?",
      slug: slugMap[id] ?? null,
      image: imageMap[id] ?? null,
      ...(isTagTeam && tagMemberImages[id] ? { memberImages: tagMemberImages[id] } : {}),
      wins: winCounts.get(id) ?? 0,
      losses: lossCounts.get(id) ?? 0,
      overallRating: ratingMap[id] ?? null,
      streak: fullStreaks.get(id) ?? 0,
      poolRank: poolRankMap.get(id) ?? null,
      elo: eloBoard.standings.get(id)?.rating ?? null,
      eloRank: eloBoard.standings.get(id)?.rank ?? null,
    };
  }

  const upNextTiers = tiersData.map((t: { id: string; tier_number: number; name: string; short_name: string | null; slug: string | null }) => ({
    id: t.id,
    tier_number: t.tier_number,
    name: t.short_name || t.name,
    fullName: t.name,
    slug: t.slug ?? null,
  }));

  // ── Recent Results ────────────────────────────────────────────────────────
  const recentMatches = playedMatches.slice(0, 10);

  // ── Power Rankings by category ──────────────────────────────────────────
  function buildRankings(filterFn: (id: string) => boolean, limit: number) {
    return Array.from(winCounts.entries())
      .filter(([id]) => filterFn(id))
      .map(([id, wins]) => {
        const losses = lossCounts.get(id) ?? 0;
        const winPct = wins / ((wins + losses) || 1);
        const streak = fullStreaks.get(id) ?? 0;
        // PWR Score formula (similar to dynasty but weighted for current season):
        // - Wins × 3: raw win count matters
        // - Win% × 100 × 2: consistency weighted heavily
        // - Streak bonus: +5 per win streak (or -3 per loss streak)
        // - Activity bonus: +1 per match played (rewards engagement)
        const streakBonus = streak > 0 ? streak * 5 : streak * 3;
        const pwr = Math.round(
          wins * 3 + winPct * 100 * 2 + streakBonus + (wins + losses)
        );
        return {
          id,
          slug: slugMap[id] ?? null,
          name: wrestlerMap[id] ?? "?",
          image: imageMap[id] ?? null,
          memberImages: tagMemberImages[id] ?? null,
          wins,
          losses,
          winPct,
          pwr,
          elo: eloBoard.standings.get(id)?.rating ?? 1200,
          eloDelta: eloBoard.standings.get(id)?.lastDelta ?? 0,
          streak,
        };
      })
      // Ranked by career Elo — opponent-strength aware, unlike the PWR composite
      .sort((a, b) => b.elo - a.elo || b.winPct - a.winPct)
      .slice(0, limit);
  }

  const tagTeamIds = new Set(Object.keys(tagMemberImages));
  const menRankings = buildRankings((id) => !tagTeamIds.has(id) && genderMap[id] === "male", 10);
  const womenRankings = buildRankings((id) => !tagTeamIds.has(id) && genderMap[id] === "female", 10);
  const menTagRankings = buildRankings((id) => tagTeamIds.has(id) && tagGenderMap[id] === "male", 5);
  const womenTagRankings = buildRankings((id) => tagTeamIds.has(id) && tagGenderMap[id] === "female", 5);

  const overallPct = totalMatches > 0 ? Math.round((totalPlayed / totalMatches) * 100) : 0;

  // ── Milestones ─────────────────────────────────────────────────────────────
  const fastestPlayedMatch = playedMatches
    .filter((m) => m.match_time_seconds)
    .sort((a, b) => a.match_time_seconds - b.match_time_seconds)[0] ?? null;

  const longestStreakEntry = onFire.length > 0 ? onFire[0] : null;

  const undefeatedWrestlers = Array.from(matchesByParticipant.entries())
    .filter(([id, pMatches]) => {
      return pMatches.length >= 2 && pMatches.every((m) => {
        const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
        return winnerId === id;
      });
    })
    .map(([id]) => wrestlerMap[id] ?? "?");

  const tiersComplete = tierProgress.filter((t) => t.played === t.total && t.total > 0).length;

  const allMatchTimes = playedMatches
    .filter((m) => m.match_time_seconds)
    .map((m) => m.match_time_seconds);
  const averageMatchTime = allMatchTimes.length > 0
    ? Math.round(allMatchTimes.reduce((a: number, b: number) => a + b, 0) / allMatchTimes.length)
    : null;

  // ── Pace and projection ───────────────────────────────────────────────────
  const firstMatchDate = playedMatches.length > 0
    ? playedMatches.reduce((earliest, m) => {
        const d = new Date(m.played_at).getTime();
        return d < earliest ? d : earliest;
      }, Infinity)
    : null;

  // Pace is the average over the last 30 days (or since the first match, if
  // the season is younger than that), so a recent burst or lull shows up and
  // the projected finish follows current form rather than the season average
  let matchesPerDay: number | null = null;
  let projectedDaysLeft: number | null = null;
  let projectedFinish: string | null = null;
  if (firstMatchDate && firstMatchDate !== Infinity && totalPlayed >= 2) {
    const DAY = 1000 * 60 * 60 * 24;
    const now = Date.now();
    const windowDays = Math.min(30, Math.max(1, (now - firstMatchDate) / DAY));
    const recent = playedMatches.filter(
      (m) => now - new Date(m.played_at).getTime() <= windowDays * DAY
    ).length;
    matchesPerDay = recent / windowDays;
    const remaining = totalMatches - totalPlayed;
    projectedDaysLeft = matchesPerDay > 0 ? Math.ceil(remaining / matchesPerDay) : null;
    if (projectedDaysLeft != null) {
      projectedFinish = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(now + projectedDaysLeft * DAY));
    }
  }

  const races = season ? computeRaces(tiersData, tierAssignmentsData, allMatchData) : [];

  const milestones = computeMilestones({
    totalPlayed,
    totalMatches,
    longestStreak: longestStreakEntry
      ? { name: longestStreakEntry.name, streak: longestStreakEntry.streak }
      : null,
    fastestMatch: fastestPlayedMatch
      ? {
          name: wrestlerMap[fastestPlayedMatch.winner_wrestler_id || fastestPlayedMatch.winner_tag_team_id || ""] ?? "?",
          time: fastestPlayedMatch.match_time_seconds,
        }
      : null,
    undefeated: undefeatedWrestlers,
    tiersCompleted: tiersComplete,
  });

  return (
    <div className="animate-fade-in">
      {/* ── Live Feed (Realtime notifications) ─────────────────────── */}
      <LiveFeed />

      {/* ── Live Ticker ─────────────────────────────────────────────── */}
      {season && totalPlayed > 0 && (
        <SeasonTicker
          totalPlayed={totalPlayed}
          totalMatches={totalMatches}
          tiersStarted={tierProgress.filter((t) => t.played > 0).length}
          totalTiers={tierProgress.length}
          fastestMatch={fastestPlayedMatch?.match_time_seconds ?? null}
          fastestMatchName={fastestPlayedMatch ? (wrestlerMap[fastestPlayedMatch.winner_wrestler_id || fastestPlayedMatch.winner_tag_team_id || ""] ?? null) : null}
          averageMatchTime={averageMatchTime}
          seasonNumber={season.season_number}
        />
      )}

      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <div className="halftone border-b-[3px] border-gold bg-card">
        <div className="container max-w-screen-2xl px-4 py-8 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-end">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <img src="/logo.svg" alt="" className="h-7 w-7" />
                {season ? (
                  <>
                    <span className="bg-gold px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-black">
                      Season {season.season_number}
                    </span>
                    <span className="border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/80">
                      {getStatusLabel(season.status)}
                    </span>
                  </>
                ) : (
                  <span className="border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Off-season
                  </span>
                )}
              </div>
              <h1 className="text-6xl leading-[0.86] sm:text-7xl lg:text-8xl">
                <span className="text-gold">WWE 2K26</span>
                <br />
                Sim League
              </h1>
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                CPU-vs-CPU title chase across 28 tiers, with promotion, relegation and
                a running Elo poll.{" "}
                <Link href="/wiki" className="font-semibold text-gold hover:underline">
                  How it works →
                </Link>
              </p>
            </div>

            {season && totalMatches > 0 && (
              <div className="border border-border bg-background">
                <div className="flex items-end justify-between gap-4 px-4 pt-4">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                      Season complete
                    </p>
                    <p className={`font-display text-7xl font-black leading-[0.85] tabular-nums ${overallPct === 100 ? "text-emerald-400" : "text-foreground"}`}>
                      {overallPct}
                      <span className="text-3xl text-gold">%</span>
                    </p>
                  </div>
                  <p className="pb-1 text-right font-mono text-xs text-muted-foreground">
                    <span className="text-lg font-bold text-foreground">{totalPlayed}</span>
                    <span> / {totalMatches}</span>
                    <br />
                    matches
                  </p>
                </div>
                <div className="mx-4 mt-3 flex h-2.5 gap-px" aria-hidden>
                  {Array.from({ length: 40 }, (_, i) => (
                    <span
                      key={i}
                      className={`flex-1 ${i < Math.round((overallPct / 100) * 40) ? (overallPct === 100 ? "bg-emerald-400" : "bg-gold") : "bg-foreground/10"}`}
                    />
                  ))}
                </div>
                <dl className="mt-4 grid grid-cols-3 border-t border-border">
                  <div className="px-4 py-2.5">
                    <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Tiers done</dt>
                    <dd className="font-display text-2xl font-extrabold leading-none tabular-nums">
                      {tierProgress.filter((t) => t.played === t.total && t.total > 0).length}
                      <span className="text-base text-muted-foreground">/{tierProgress.length}</span>
                    </dd>
                  </div>
                  <div className="border-l border-border px-4 py-2.5">
                    <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Pace · 30 days</dt>
                    <dd className="font-display text-2xl font-extrabold leading-none tabular-nums">
                      {matchesPerDay != null ? matchesPerDay.toFixed(2) : "–"}
                      {matchesPerDay != null && <span className="text-base text-muted-foreground">/day</span>}
                    </dd>
                  </div>
                  <div className="border-l border-border px-4 py-2.5">
                    <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Finishes in</dt>
                    <dd className="font-display text-2xl font-extrabold leading-none tabular-nums">
                      {totalPlayed >= totalMatches ? "Done" : projectedDaysLeft ? <>~{projectedDaysLeft}<span className="text-base text-muted-foreground">d</span></> : "–"}
                    </dd>
                    {totalPlayed < totalMatches && projectedFinish && (
                      <dd className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground whitespace-nowrap">
                        {projectedFinish}
                      </dd>
                    )}
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container max-w-screen-2xl px-4 py-6 space-y-8">

        {/* ── Milestones ──────────────────────────────────────────────── */}
        {milestones.length > 0 && <MilestonesBanner milestones={milestones} />}

        {/* ── Up Next + Latest Result | On Fire | Ice Cold ─────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr]">
          {/* Left: Up Next stacked with Latest Result */}
          <div className="min-w-0 space-y-3">
            {unplayedMatches.length > 0 && (
              <UpNextCard
                matches={unplayedMatches}
                participantStats={upNextParticipantStats}
                tiers={upNextTiers}
                remainingCount={unplayedMatches.length}
                initialIndex={Math.floor(Math.random() * unplayedMatches.length)}
              />
            )}

            {featuredMatch && (() => {
              const fAId = featuredMatch.wrestler_a_id || featuredMatch.tag_team_a_id;
              const fBId = featuredMatch.wrestler_b_id || featuredMatch.tag_team_b_id;
              const fWinnerId = featuredMatch.winner_wrestler_id || featuredMatch.winner_tag_team_id;
              const fIsTag = !!featuredMatch.tag_team_a_id;
              const fAName = wrestlerMap[fAId ?? ""] ?? "?";
              const fBName = wrestlerMap[fBId ?? ""] ?? "?";
              const fAWins = winCounts.get(fAId ?? "") ?? 0;
              const fALosses = lossCounts.get(fAId ?? "") ?? 0;
              const fBWins = winCounts.get(fBId ?? "") ?? 0;
              const fBLosses = lossCounts.get(fBId ?? "") ?? 0;
              const fAImg = imageMap[fAId ?? ""];
              const fBImg = imageMap[fBId ?? ""];
              const isAWinner = fWinnerId === fAId;
              const aHref = fIsTag ? `/tag-teams/${fAId}` : `/roster/${slugMap[fAId ?? ""] ?? fAId}`;
              const bHref = fIsTag ? `/tag-teams/${fBId}` : `/roster/${slugMap[fBId ?? ""] ?? fBId}`;
              const fMove = eloBoard.moves.get(featuredMatch.id) ?? null;

              return (
                <div className="border border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-gold/80">Latest</span>
                    {/* Winner */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {fAImg ? (
                        <SmartImage src={fAImg} alt="" width={64} height={64} className={`h-8 w-8 rounded-full object-cover border ${isAWinner ? "border-gold" : "border-border/20 opacity-50"} shrink-0`} />
                      ) : (
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isAWinner ? "bg-gold/10 border border-gold text-gold" : "bg-muted/20 border border-border/20 text-muted-foreground/30 opacity-50"}`}>
                          {fAName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link href={aHref} className={`text-sm font-bold truncate block hover:underline ${isAWinner ? "text-gold" : "text-muted-foreground"}`}>
                          {fAName}
                        </Link>
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[10px] text-muted-foreground tabular-nums">{fAWins}W-{fALosses}L</span>
                          <EloMoveChip move={fMove?.a ?? null} />
                        </span>
                      </div>
                    </div>
                    {/* VS + Time */}
                    <div className="text-center shrink-0">
                      <span className="text-[9px] font-black text-muted-foreground/15">VS</span>
                      {featuredMatch.match_time_seconds && (
                        <div className="text-[11px] tabular-nums text-muted-foreground">{formatTime(featuredMatch.match_time_seconds)}</div>
                      )}
                    </div>
                    {/* Loser */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 flex-row-reverse">
                      {fBImg ? (
                        <SmartImage src={fBImg} alt="" width={64} height={64} className={`h-8 w-8 rounded-full object-cover border ${!isAWinner ? "border-gold" : "border-border/20 opacity-50"} shrink-0`} />
                      ) : (
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${!isAWinner ? "bg-gold/10 border border-gold text-gold" : "bg-muted/20 border border-border/20 text-muted-foreground/30 opacity-50"}`}>
                          {fBName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 text-right">
                        <Link href={bHref} className={`text-sm font-bold truncate block hover:underline ${!isAWinner ? "text-gold" : "text-muted-foreground"}`}>
                          {fBName}
                        </Link>
                        <span className="flex flex-wrap items-baseline justify-end gap-x-2">
                          <EloMoveChip move={fMove?.b ?? null} />
                          <span className="text-[10px] text-muted-foreground tabular-nums">{fBWins}W-{fBLosses}L</span>
                        </span>
                      </div>
                    </div>
                    {/* Undo */}
                    <UndoMatchButton matchId={featuredMatch.id} winnerName={wrestlerMap[fWinnerId ?? ""] ?? "?"} />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* On Fire (own column) */}
          {onFire.length > 0 && (
            <div className="min-w-0">
              <h3 className="rule-title mb-2 text-xl">
                On Fire
              </h3>
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-1.5 lg:grid-cols-1">
                {onFire.slice(0, 8).map((w) => (
                  <Link key={w.id} href={`/roster/${w.slug ?? w.id}`} className="flex items-center gap-2 rounded-lg border border-amber-500/10 bg-amber-500/[0.03] px-2 py-1.5 hover:border-amber-500/25 transition-all group">
                    {w.image ? (
                      <SmartImage src={w.image} alt="" width={56} height={56} className="h-7 w-7 rounded-full object-cover border border-amber-500/20 shrink-0" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-[11px] font-semibold truncate flex-1 group-hover:text-gold transition-colors">{w.name}</span>
                    <span className="text-[9px] font-bold text-amber-400 shrink-0">
                      W{w.streak}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Ice Cold (own column) */}
          {iceCold.length > 0 && (
            <div className="min-w-0">
              <h3 className="rule-title mb-2 text-xl">
                Ice Cold
              </h3>
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-1.5 lg:grid-cols-1">
                {iceCold.slice(0, 8).map((w) => (
                  <Link key={w.id} href={`/roster/${w.slug ?? w.id}`} className="flex items-center gap-2 rounded-lg border border-blue-500/10 bg-blue-500/[0.03] px-2 py-1.5 hover:border-blue-500/25 transition-all group">
                    {w.image ? (
                      <SmartImage src={w.image} alt="" width={56} height={56} className="h-7 w-7 rounded-full object-cover border border-blue-500/20 grayscale-[30%] shrink-0" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-[11px] font-semibold truncate flex-1 group-hover:text-blue-400 transition-colors">{w.name}</span>
                    <span className="text-[9px] font-bold text-blue-400 shrink-0">
                      L{Math.abs(w.streak)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Power Rankings (3 columns) ──────────────────────────────── */}
        {(menRankings.length > 0 || womenRankings.length > 0) && (
          <div>
            <h2 className="rule-title mb-3 flex items-baseline gap-1.5 text-2xl">
              Elo Rankings
              <Link href="/rankings" className="ml-auto text-[10px] font-semibold normal-case tracking-normal text-gold/70 hover:text-gold">Full rankings →</Link>
            </h2>
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Men's Top 10 */}
              {menRankings.length > 0 && (
                <Card className="border-border/30 bg-card/50">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-blue-400/70">Men&apos;s Singles</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex items-center gap-2 mb-2 px-0.5">
                      <span className="w-5" />
                      <span className="w-7" />
                      <span className="flex-1" />
                      <span className="text-[8px] uppercase tracking-wider text-muted-foreground/30 font-bold">W-L</span>
                      <span className="text-[8px] uppercase tracking-wider text-gold/30 font-bold w-8 text-right">ELO</span>
                    </div>
                    <div className="space-y-1.5">
                    {menRankings.map((w, i) => (
                      <Link key={w.id} href={`/roster/${w.slug ?? w.id}`} className="flex items-center gap-2 group">
                        <span className={`text-sm font-black tabular-nums w-5 text-right ${i === 0 ? "text-gold" : i < 3 ? "text-foreground/60" : "text-muted-foreground/30"}`}>{i + 1}</span>
                        {w.image ? (
                          <SmartImage src={w.image} alt="" width={56} height={56} className="h-7 w-7 rounded-full object-cover border border-border/20 shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                          </div>
                        )}
                        <span className="text-xs font-semibold truncate flex-1 group-hover:text-gold transition-colors">{w.name}</span>
                        <span className="text-[10px] tabular-nums text-foreground/60 shrink-0">{w.wins}W-{w.losses}L</span>
                        <span className={`text-[9px] tabular-nums shrink-0 w-6 text-right ${w.eloDelta > 0 ? "text-emerald-400/80" : w.eloDelta < 0 ? "text-red-400/80" : "text-muted-foreground/30"}`}>{w.eloDelta > 0 ? `+${w.eloDelta}` : w.eloDelta || "—"}</span>
                        <span className="text-[10px] tabular-nums text-gold font-bold shrink-0 w-8 text-right">{w.elo}</span>
                      </Link>
                    ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Women's Top 10 */}
              {womenRankings.length > 0 && (
                <Card className="border-border/30 bg-card/50">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-purple-400/70">Women&apos;s Singles</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex items-center gap-2 mb-2 px-0.5">
                      <span className="w-5" />
                      <span className="w-7" />
                      <span className="flex-1" />
                      <span className="text-[8px] uppercase tracking-wider text-muted-foreground/30 font-bold">W-L</span>
                      <span className="text-[8px] uppercase tracking-wider text-gold/30 font-bold w-8 text-right">ELO</span>
                    </div>
                    <div className="space-y-1.5">
                    {womenRankings.map((w, i) => (
                      <Link key={w.id} href={`/roster/${w.slug ?? w.id}`} className="flex items-center gap-2 group">
                        <span className={`text-sm font-black tabular-nums w-5 text-right ${i === 0 ? "text-gold" : i < 3 ? "text-foreground/60" : "text-muted-foreground/30"}`}>{i + 1}</span>
                        {w.image ? (
                          <SmartImage src={w.image} alt="" width={56} height={56} className="h-7 w-7 rounded-full object-cover border border-border/20 shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                          </div>
                        )}
                        <span className="text-xs font-semibold truncate flex-1 group-hover:text-gold transition-colors">{w.name}</span>
                        <span className="text-[10px] tabular-nums text-foreground/60 shrink-0">{w.wins}W-{w.losses}L</span>
                        <span className={`text-[9px] tabular-nums shrink-0 w-6 text-right ${w.eloDelta > 0 ? "text-emerald-400/80" : w.eloDelta < 0 ? "text-red-400/80" : "text-muted-foreground/30"}`}>{w.eloDelta > 0 ? `+${w.eloDelta}` : w.eloDelta || "—"}</span>
                        <span className="text-[10px] tabular-nums text-gold font-bold shrink-0 w-8 text-right">{w.elo}</span>
                      </Link>
                    ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tag Teams (Men's + Women's stacked) */}
              <Card className="border-border/30 bg-card/50">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/70">Tag Teams</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pb-4">
                  {menTagRankings.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-blue-400/60 mb-1.5">Men&apos;s</div>
                      <div className="space-y-1.5">
                        {menTagRankings.map((w, i) => (
                          <Link key={w.id} href={`/tag-teams/${w.id}`} className="flex items-center gap-2 group">
                            <span className={`text-sm font-black tabular-nums w-5 text-right ${i === 0 ? "text-gold" : "text-muted-foreground/30"}`}>{i + 1}</span>
                            {w.memberImages ? (
                              <div className="flex -space-x-1.5 shrink-0">
                                {w.memberImages[0] ? (
                                  <SmartImage src={w.memberImages[0]} alt="" width={48} height={48} className="h-6 w-6 rounded-full object-cover border border-background shrink-0 relative z-10" />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-muted/30 border border-background shrink-0 relative z-10" />
                                )}
                                {w.memberImages[1] ? (
                                  <SmartImage src={w.memberImages[1]} alt="" width={48} height={48} className="h-6 w-6 rounded-full object-cover border border-background shrink-0" />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-muted/30 border border-background shrink-0" />
                                )}
                              </div>
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                              </div>
                            )}
                            <span className="text-xs font-semibold truncate flex-1 group-hover:text-gold transition-colors">{w.name}</span>
                            <span className="text-[10px] tabular-nums text-foreground/60 shrink-0">{w.wins}W-{w.losses}L</span>
                            <span className={`text-[9px] tabular-nums shrink-0 w-6 text-right ${w.eloDelta > 0 ? "text-emerald-400/80" : w.eloDelta < 0 ? "text-red-400/80" : "text-muted-foreground/30"}`}>{w.eloDelta > 0 ? `+${w.eloDelta}` : w.eloDelta || "—"}</span>
                        <span className="text-[10px] tabular-nums text-gold font-bold shrink-0 w-8 text-right">{w.elo}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {womenTagRankings.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-purple-400/60 mb-1.5">Women&apos;s</div>
                      <div className="space-y-1.5">
                        {womenTagRankings.map((w, i) => (
                          <Link key={w.id} href={`/tag-teams/${w.id}`} className="flex items-center gap-2 group">
                            <span className={`text-sm font-black tabular-nums w-5 text-right ${i === 0 ? "text-gold" : "text-muted-foreground/30"}`}>{i + 1}</span>
                            {w.memberImages ? (
                              <div className="flex -space-x-1.5 shrink-0">
                                {w.memberImages[0] ? (
                                  <SmartImage src={w.memberImages[0]} alt="" width={48} height={48} className="h-6 w-6 rounded-full object-cover border border-background shrink-0 relative z-10" />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-muted/30 border border-background shrink-0 relative z-10" />
                                )}
                                {w.memberImages[1] ? (
                                  <SmartImage src={w.memberImages[1]} alt="" width={48} height={48} className="h-6 w-6 rounded-full object-cover border border-background shrink-0" />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-muted/30 border border-background shrink-0" />
                                )}
                              </div>
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                              </div>
                            )}
                            <span className="text-xs font-semibold truncate flex-1 group-hover:text-gold transition-colors">{w.name}</span>
                            <span className="text-[10px] tabular-nums text-foreground/60 shrink-0">{w.wins}W-{w.losses}L</span>
                            <span className={`text-[9px] tabular-nums shrink-0 w-6 text-right ${w.eloDelta > 0 ? "text-emerald-400/80" : w.eloDelta < 0 ? "text-red-400/80" : "text-muted-foreground/30"}`}>{w.eloDelta > 0 ? `+${w.eloDelta}` : w.eloDelta || "—"}</span>
                        <span className="text-[10px] tabular-nums text-gold font-bold shrink-0 w-8 text-right">{w.elo}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {menTagRankings.length === 0 && womenTagRankings.length === 0 && (
                    <p className="text-xs text-muted-foreground/40 py-2">No tag team results yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── Bubble Watch ────────────────────────────────────────────── */}
        {races.length > 0 && (
          <section>
            <div className="rule-title flex items-baseline justify-between gap-4">
              <h2 className="text-2xl">Bubble Watch</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Tightest races
              </span>
            </div>
            <div className="grid pl-px sm:grid-cols-2 xl:grid-cols-4">
              {races.map((r) => {
                const kind = {
                  playoff: { label: "Playoff line", text: "text-gold", bar: "bg-gold", verb: "holds the last playoff spot" },
                  promotion: { label: "Promotion", text: "text-emerald-400", bar: "bg-emerald-500", verb: "holds the last promotion place" },
                  drop: { label: "Drop zone", text: "text-red-400", bar: "bg-red-500", verb: "is the last one safe" },
                }[r.kind];
                const plate = tierColor(r.tierSlug ?? r.tierName);
                const href = (id: string) =>
                  slugMap[id] || genderMap[id] ? `/roster/${slugMap[id] ?? id}` : `/tag-teams/${id}`;
                return (
                  <div key={`${r.tierId}-${r.kind}`} className="-ml-px -mt-px flex flex-col border border-border bg-card">
                    <div className="flex items-center justify-between gap-2 px-3 pt-3">
                      <Link
                        href={`/tiers/${r.tierSlug ?? r.tierId}`}
                        className="px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: plate.bg, color: plate.fg }}
                      >
                        T{r.tierNumber} · {r.tierName}
                      </Link>
                      <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.2em] ${kind.text}`}>
                        {kind.label}
                      </span>
                    </div>
                    <div className="px-3 pb-2 pt-3">
                      <Link href={href(r.above.id)} className="flex items-baseline justify-between gap-2 hover:text-gold">
                        <span className="font-display text-xl font-extrabold leading-none [overflow-wrap:anywhere]">
                          {wrestlerMap[r.above.id] ?? "?"}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {r.above.wins}-{r.above.losses}
                        </span>
                      </Link>
                      <div className="my-1.5 flex items-center gap-2">
                        <span className={`h-0.5 flex-1 ${kind.bar}`} />
                        <span className={`font-mono text-[10px] font-bold ${kind.text}`}>
                          {r.gap === 0 ? "LEVEL" : `${r.gap.toFixed(1)} GB`}
                        </span>
                      </div>
                      <Link href={href(r.below.id)} className="flex items-baseline justify-between gap-2 text-muted-foreground hover:text-gold">
                        <span className="font-display text-xl font-extrabold leading-none [overflow-wrap:anywhere]">
                          {wrestlerMap[r.below.id] ?? "?"}
                        </span>
                        <span className="shrink-0 font-mono text-xs">
                          {r.below.wins}-{r.below.losses}
                        </span>
                      </Link>
                    </div>
                    <p className="mt-auto border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
                      {wrestlerMap[r.above.id] ?? "?"} {kind.verb}
                      {r.gap === 0 ? " on a tiebreak" : ""} · {Math.round(r.progress * 100)}% played
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Recent Results + Tier Map Row ─────────────────────────── */}
        <div className={`grid gap-6 ${tierProgress.length > 0 && recentMatches.length > 0 ? "lg:grid-cols-2" : ""}`}>
          {/* Recent Results */}
          {recentMatches.length > 0 && (
            <section className="min-w-0">
              <h2 className="rule-title text-2xl">Recent Results</h2>
              <div className="border border-t-0 border-border bg-card divide-y divide-border/60">
                {recentMatches.map((m, matchIdx) => {
                  const aId = m.wrestler_a_id || m.tag_team_a_id;
                  const bId = m.wrestler_b_id || m.tag_team_b_id;
                  const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
                  const aName = wrestlerMap[aId ?? ""] ?? "?";
                  const bName = wrestlerMap[bId ?? ""] ?? "?";
                  const isAWinner = winnerId === aId;
                  const isTag = !!m.tag_team_a_id;
                  const time = m.match_time_seconds ? formatTime(m.match_time_seconds) : null;
                  const aImgs = isTag && tagMemberImages[aId ?? ""] ? tagMemberImages[aId ?? ""] : null;
                  const bImgs = isTag && tagMemberImages[bId ?? ""] ? tagMemberImages[bId ?? ""] : null;
                  const aImg = !isTag ? imageMap[aId ?? ""] : null;
                  const bImg = !isTag ? imageMap[bId ?? ""] : null;
                  return (
                    <div key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-foreground/[0.03] transition-colors">
                      {/* A photo */}
                      {aImgs ? (
                        <div className="flex -space-x-1.5 shrink-0">
                          {aImgs[0] ? <SmartImage src={aImgs[0]} alt="" width={48} height={48} className="h-8 w-8 object-cover object-top border border-background relative z-10" /> : <div className="h-8 w-8 bg-muted/30 border border-background relative z-10" />}
                          {aImgs[1] ? <SmartImage src={aImgs[1]} alt="" width={48} height={48} className="h-8 w-8 object-cover object-top border border-background" /> : <div className="h-8 w-8 bg-muted/30 border border-background" />}
                        </div>
                      ) : aImg ? (
                        <SmartImage src={aImg} alt="" width={48} height={48} className="h-8 w-8 object-cover object-top border border-border/20 shrink-0" />
                      ) : (
                        <div className="h-8 w-8 bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-bold text-muted-foreground/30">{aName.charAt(0)}</span>
                        </div>
                      )}
                      {isTag ? (
                        <Link href={`/tag-teams/${aId}`} className={`truncate hover:underline ${isAWinner ? "font-display text-lg font-extrabold leading-none text-foreground" : "text-muted-foreground"}`}>
                          <RankBadge rank={eloBoard.standings.get(aId ?? "")?.rank} />{aName}<span className="ml-1.5 font-mono text-[10px] font-normal text-muted-foreground/70">({winCounts.get(aId ?? "") ?? 0}-{lossCounts.get(aId ?? "") ?? 0})</span>
                        </Link>
                      ) : (
                        <Link href={`/roster/${slugMap[aId ?? ""] ?? aId}`} className={`truncate hover:underline ${isAWinner ? "font-display text-lg font-extrabold leading-none text-foreground" : "text-muted-foreground"}`}>
                          <RankBadge rank={eloBoard.standings.get(aId ?? "")?.rank} />{aName}<span className="ml-1.5 font-mono text-[10px] font-normal text-muted-foreground/70">({winCounts.get(aId ?? "") ?? 0}-{lossCounts.get(aId ?? "") ?? 0})</span>
                        </Link>
                      )}
                      <span className="text-[9px] text-muted-foreground/30 shrink-0">vs</span>
                      {isTag ? (
                        <Link href={`/tag-teams/${bId}`} className={`truncate hover:underline ${!isAWinner ? "font-display text-lg font-extrabold leading-none text-foreground" : "text-muted-foreground"}`}>
                          <RankBadge rank={eloBoard.standings.get(bId ?? "")?.rank} />{bName}<span className="ml-1.5 font-mono text-[10px] font-normal text-muted-foreground/70">({winCounts.get(bId ?? "") ?? 0}-{lossCounts.get(bId ?? "") ?? 0})</span>
                        </Link>
                      ) : (
                        <Link href={`/roster/${slugMap[bId ?? ""] ?? bId}`} className={`truncate hover:underline ${!isAWinner ? "font-display text-lg font-extrabold leading-none text-foreground" : "text-muted-foreground"}`}>
                          <RankBadge rank={eloBoard.standings.get(bId ?? "")?.rank} />{bName}<span className="ml-1.5 font-mono text-[10px] font-normal text-muted-foreground/70">({winCounts.get(bId ?? "") ?? 0}-{lossCounts.get(bId ?? "") ?? 0})</span>
                        </Link>
                      )}
                      {/* B photo */}
                      {bImgs ? (
                        <div className="flex -space-x-1.5 shrink-0">
                          {bImgs[0] ? <SmartImage src={bImgs[0]} alt="" width={48} height={48} className="h-8 w-8 object-cover object-top border border-background relative z-10" /> : <div className="h-8 w-8 bg-muted/30 border border-background relative z-10" />}
                          {bImgs[1] ? <SmartImage src={bImgs[1]} alt="" width={48} height={48} className="h-8 w-8 object-cover object-top border border-background" /> : <div className="h-8 w-8 bg-muted/30 border border-background" />}
                        </div>
                      ) : bImg ? (
                        <SmartImage src={bImg} alt="" width={48} height={48} className="h-8 w-8 object-cover object-top border border-border/20 shrink-0" />
                      ) : (
                        <div className="h-8 w-8 bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-bold text-muted-foreground/30">{bName.charAt(0)}</span>
                        </div>
                      )}
                      <span className="ml-auto flex items-center gap-2 shrink-0">
                        {(() => {
                          const odds = eloBoard.odds.get(m.id);
                          return odds && odds.winnerProb < 0.35 ? (
                            <Link href={`/match/${m.id}`} className="bg-wwe-red px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white hover:brightness-110" title={`The winner had a ${Math.round(odds.winnerProb * 100)}% chance`}>
                              Upset {Math.round(odds.winnerProb * 100)}%
                            </Link>
                          ) : null;
                        })()}
                        {time && <span className="text-xs tabular-nums text-muted-foreground">{time}</span>}
                        {matchIdx === 0 && (
                          <UndoMatchButton matchId={m.id} winnerName={wrestlerMap[winnerId ?? ""] ?? "?"} />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tier Progress Map */}
          {tierProgress.length > 0 && (
            <section className="min-w-0">
              <h2 className="rule-title text-2xl">Tier Progress</h2>
              <div className="space-y-4 border border-t-0 border-border bg-card p-3">
                {(() => {
                  const divColors: Record<string, { border: string; bg: string; text: string; dot: string; fill: string }> = {
                    "Men's Singles": { border: "border-blue-500/25", bg: "bg-blue-500/8", text: "text-blue-400", dot: "bg-blue-500", fill: "59,130,246" },
                    "Women's Singles": { border: "border-purple-500/25", bg: "bg-purple-500/8", text: "text-purple-400", dot: "bg-purple-500", fill: "168,85,247" },
                    "Men's Tag Teams": { border: "border-emerald-500/25", bg: "bg-emerald-500/8", text: "text-emerald-400", dot: "bg-emerald-500", fill: "16,185,129" },
                    "Women's Tag Teams": { border: "border-orange-500/25", bg: "bg-orange-500/8", text: "text-orange-400", dot: "bg-orange-500", fill: "249,115,22" },
                  };
                  const groups = [
                    { label: "Men's Singles", tiers: tierProgress.filter((t) => t.divisionName === "Men's Singles") },
                    { label: "Women's Singles", tiers: tierProgress.filter((t) => t.divisionName === "Women's Singles") },
                    { label: "Men's Tag", tiers: tierProgress.filter((t) => t.divisionName === "Men's Tag Teams") },
                    { label: "Women's Tag", tiers: tierProgress.filter((t) => t.divisionName === "Women's Tag Teams") },
                  ].filter((g) => g.tiers.length > 0);

                  return groups.map((g) => {
                    const c = divColors[g.label === "Men's Tag" ? "Men's Tag Teams" : g.label === "Women's Tag" ? "Women's Tag Teams" : g.label] ?? divColors["Men's Singles"];
                    return (
                      <div key={g.label}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`h-2 w-2 ${c.dot}`} />
                          <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] ${c.text}`}>{g.label}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 sm:grid-cols-8 lg:grid-cols-4 xl:grid-cols-8">
                          {g.tiers.map((t) => {
                            const pct = t.total > 0 ? Math.round((t.played / t.total) * 100) : 0;
                            const done = pct === 100;
                            return (
                              <Link key={t.tierId} href={`/tiers/${t.tierSlug ?? t.tierId}`}>
                                <div
                                  className={`border px-1.5 py-2 text-center hover:border-gold transition-colors relative overflow-hidden ${
                                    done
                                      ? "border-emerald-500/30"
                                      : pct > 0
                                        ? c.border
                                        : "border-border/20"
                                  }`}
                                  style={
                                    done
                                      ? { background: `rgba(16,185,129,0.15)` }
                                      : pct > 0
                                        ? { background: `linear-gradient(to right, rgba(${c.fill},0.15) ${pct}%, transparent ${pct}%)` }
                                        : {}
                                  }
                                  title={`${t.tierName}: ${t.played}/${t.total} (${pct}%)`}
                                >
                                  <span className="block truncate font-display text-sm font-extrabold uppercase leading-none relative z-10">{t.tierName}</span>
                                  <span className={`mt-1 block text-[10px] font-bold tabular-nums relative z-10 ${
                                    done ? "text-emerald-400" : pct > 0 ? c.text : "text-muted-foreground/30"
                                  }`}>
                                    {pct}%
                                  </span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </section>
          )}
        </div>

        {/* ── Championship Belt Gallery ───────────────────────────────── */}
        {champions.length > 0 && (
          <section>
            <h2 className="rule-title text-2xl">Championship Holders</h2>
            <div className="grid grid-cols-2 pl-px sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {champions.sort((a, b) => a.tierNumber - b.tierNumber).map((c) => (
                <div key={c.tierName} className="group -ml-px -mt-px border border-border bg-card p-3" style={{ borderTop: `3px solid ${tierColor(c.tierName).bg}` }}>
                  {c.beltImageUrl ? (
                    <SmartImage src={c.beltImageUrl} alt={c.tierName} width={240} height={96} className="mx-auto mb-3 h-12 w-full object-contain opacity-85 transition-opacity group-hover:opacity-100" />
                  ) : (
                    <div className="mb-3 flex h-12 items-center justify-center font-display text-4xl font-black text-gold/25">
                      T{c.tierNumber}
                    </div>
                  )}
                  <p className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-gold/80">{c.tierName}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {imageMap[c.holderId] ? (
                      <SmartImage src={imageMap[c.holderId]} alt="" width={56} height={56} className="h-7 w-7 shrink-0 object-cover object-top" />
                    ) : null}
                    <p className="font-display text-lg font-extrabold leading-none [overflow-wrap:anywhere]">{c.holderName}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Stats Bar ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-px border border-border bg-border">
          {[
            { label: "Wrestlers", value: wrestlerCount ?? 0, href: "/roster" },
            { label: "Tag Teams", value: tagTeamCount ?? 0, href: "/tag-teams" },
            { label: "Seasons Completed", value: completedSeasons ?? 0, href: "/history" },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="group bg-card px-4 py-4 transition-colors hover:bg-foreground/[0.03]">
              <p className="font-display text-5xl font-black leading-[0.85] tabular-nums group-hover:text-gold">{stat.value}</p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
            </Link>
          ))}
        </div>

        {/* ── Empty State ────────────────────────────────────────────── */}
        {playedMatches.length === 0 && !season && (
          <div className="halftone border border-dashed border-border bg-card/40 px-6 py-16 text-center">
            <img src="/logo.svg" alt="" width={56} height={56} className="mx-auto mb-4 opacity-40" />
            <h3 className="text-3xl">Ready to Begin</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
              Add wrestlers to the roster and set up your first season to start the simulation.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/roster"><Button variant="outline" size="sm">Add Wrestlers</Button></Link>
              <Link href="/season/setup"><Button size="sm" className="bg-gold text-black hover:bg-gold-dark font-semibold">Setup Season 1</Button></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
