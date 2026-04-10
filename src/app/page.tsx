import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
    supabase.from("wrestlers").select("id, name, image_url, overall_rating, slug, gender"),
  ]);

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
    const [{ data: allMatches }, { data: tiers }, { data: tagTeamNames }, { data: tierAssignments }] = await Promise.all([
      supabase
        .from("matches")
        .select("id, wrestler_a_id, wrestler_b_id, tag_team_a_id, tag_team_b_id, winner_wrestler_id, winner_tag_team_id, stipulation, match_phase, match_time_seconds, tier_id, played_at")
        .eq("season_id", season.id)
        .order("played_at", { ascending: false }),
      supabase
        .from("tiers")
        .select("id, tier_number, name, short_name, color, belt_image_url, slug, divisions(name, gender)")
        .order("tier_number"),
      supabase.from("tag_teams").select("id, name, wrestler_a:wrestlers!tag_teams_wrestler_a_id_fkey(image_url, gender), wrestler_b:wrestlers!tag_teams_wrestler_b_id_fkey(image_url, gender)"),
      supabase.from("tier_assignments").select("tier_id, wrestler_id, tag_team_id, pool").eq("season_id", season.id),
    ]);

    allMatchData = allMatches ?? [];
    tiersData = tiers ?? [];
    tierAssignmentsData = tierAssignments ?? [];

    for (const t of tagTeamNames ?? []) {
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

    tierProgress = (tiers ?? [])
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
      .select("id, short_name, name, tier_number, belt_image_url")
      .order("tier_number");

    champions = (finals ?? []).map((f) => {
      const tier = (tierNames ?? []).find((t) => t.id === f.tier_id);
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
          streak,
        };
      })
      .sort((a, b) => b.pwr - a.pwr || b.winPct - a.winPct)
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

  let matchesPerDay: number | null = null;
  let projectedDaysLeft: number | null = null;
  if (firstMatchDate && firstMatchDate !== Infinity && totalPlayed >= 2) {
    const daysSinceFirst = Math.max(1, (Date.now() - firstMatchDate) / (1000 * 60 * 60 * 24));
    matchesPerDay = Math.round((totalPlayed / daysSinceFirst) * 10) / 10;
    const remaining = totalMatches - totalPlayed;
    projectedDaysLeft = matchesPerDay > 0 ? Math.ceil(remaining / matchesPerDay) : null;
  }

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

      {/* ── Hero Banner ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border/20">
        <div className="absolute inset-0 bg-gradient-to-r from-gold/[0.03] via-transparent to-wwe-red/[0.03]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.08),transparent_60%)]" />
        <div className="container max-w-screen-2xl px-4 py-10 sm:py-14 relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <img src="/logo.svg" alt="" className="h-10 w-10" />
                {season && (
                  <Badge className={`${getStatusColor(season.status)} text-[10px] uppercase tracking-widest font-bold`}>
                    Season {season.season_number} · {getStatusLabel(season.status)}
                  </Badge>
                )}
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                <span className="bg-gradient-to-r from-gold via-amber-300 to-gold bg-clip-text text-transparent">
                  WWE 2K26
                </span>
              </h1>
              <p className="text-lg sm:text-xl font-medium text-foreground/70 mt-1">
                Simulation League
              </p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                CPU-vs-CPU championship simulation across 28 tiers with promotion, relegation, and dynasty tracking.{" "}
                <Link href="/wiki" className="text-gold/70 hover:text-gold transition-colors">
                  Learn more →
                </Link>
              </p>
              {/* Mobile-only compact progress */}
              {season && totalMatches > 0 && (
                <div className="flex items-center gap-3 mt-3 sm:hidden">
                  <div className="h-1.5 flex-1 max-w-32 rounded-full bg-muted/20 overflow-hidden">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${overallPct}%` }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-gold">{overallPct}%</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{totalPlayed}/{totalMatches}</span>
                </div>
              )}
            </div>

            {/* Season Progress Ring — hidden on mobile */}
            {season && totalMatches > 0 && (
              <div className="hidden sm:flex items-center gap-6">
                <div className="relative h-32 w-32 shrink-0">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <defs>
                      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgb(212,175,55)" />
                        <stop offset="100%" stopColor="rgb(245,158,11)" />
                      </linearGradient>
                    </defs>
                    {/* Track ring — visible in dark mode */}
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" stroke="rgba(255,255,255,0.08)" />
                    {/* Progress fill */}
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${overallPct * 2.64} 264`}
                      stroke={overallPct === 100 ? "rgb(16,185,129)" : "url(#ringGrad)"}
                      style={{ filter: "drop-shadow(0 0 6px rgba(212,175,55,0.3))" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black tabular-nums">{overallPct}%</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Complete</span>
                  </div>
                </div>
                <div className="text-sm space-y-1 hidden sm:block">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Matches:</span>
                    <span className="font-bold tabular-nums">{totalPlayed}/{totalMatches}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Tiers:</span>
                    <span className="font-bold tabular-nums">{tierProgress.filter((t) => t.played === t.total && t.total > 0).length}/{tierProgress.length}</span>
                  </div>
                  {matchesPerDay && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Pace:</span>
                      <span className="font-bold tabular-nums">{matchesPerDay}/day</span>
                    </div>
                  )}
                  {projectedDaysLeft && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">ETA:</span>
                      <span className="font-bold tabular-nums">~{projectedDaysLeft}d</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container max-w-screen-2xl px-4 py-6 space-y-8">

        {/* ── Milestones ──────────────────────────────────────────────── */}
        {milestones.length > 0 && <MilestonesBanner milestones={milestones} />}

        {/* ── Up Next + Latest Result | On Fire | Ice Cold ─────────── */}
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr]">
          {/* Left: Up Next stacked with Latest Result */}
          <div className="space-y-3">
            {unplayedMatches.length > 0 && (
              <UpNextCard
                matches={unplayedMatches}
                participantStats={upNextParticipantStats}
                tiers={upNextTiers}
                remainingCount={unplayedMatches.length}
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
              const aHref = fIsTag ? "/tag-teams" : `/roster/${slugMap[fAId ?? ""] ?? fAId}`;
              const bHref = fIsTag ? "/tag-teams" : `/roster/${slugMap[fBId ?? ""] ?? fBId}`;

              return (
                <div className="rounded-xl border border-border/30 bg-card/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">Latest</span>
                    {/* Winner */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {fAImg ? (
                        <img src={fAImg} alt="" className={`h-8 w-8 rounded-full object-cover border ${isAWinner ? "border-gold" : "border-border/20 opacity-50"} shrink-0`} />
                      ) : (
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isAWinner ? "bg-gold/10 border border-gold text-gold" : "bg-muted/20 border border-border/20 text-muted-foreground/30 opacity-50"}`}>
                          {fAName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link href={aHref} className={`text-xs font-bold truncate block hover:underline ${isAWinner ? "text-gold" : "text-muted-foreground/50"}`}>
                          {fAName}
                        </Link>
                        <span className="text-[9px] text-muted-foreground/40 tabular-nums">{fAWins}W-{fALosses}L</span>
                      </div>
                    </div>
                    {/* VS + Time */}
                    <div className="text-center shrink-0">
                      <span className="text-[9px] font-black text-muted-foreground/15">VS</span>
                      {featuredMatch.match_time_seconds && (
                        <div className="text-[9px] tabular-nums text-muted-foreground/30">{formatTime(featuredMatch.match_time_seconds)}</div>
                      )}
                    </div>
                    {/* Loser */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 flex-row-reverse">
                      {fBImg ? (
                        <img src={fBImg} alt="" className={`h-8 w-8 rounded-full object-cover border ${!isAWinner ? "border-gold" : "border-border/20 opacity-50"} shrink-0`} />
                      ) : (
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${!isAWinner ? "bg-gold/10 border border-gold text-gold" : "bg-muted/20 border border-border/20 text-muted-foreground/30 opacity-50"}`}>
                          {fBName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 text-right">
                        <Link href={bHref} className={`text-xs font-bold truncate block hover:underline ${!isAWinner ? "text-gold" : "text-muted-foreground/50"}`}>
                          {fBName}
                        </Link>
                        <span className="text-[9px] text-muted-foreground/40 tabular-nums">{fBWins}W-{fBLosses}L</span>
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
            <div className="max-h-[400px] overflow-y-auto">
              <h3 className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-2 flex items-center gap-1">
                <span>🔥</span> On Fire
              </h3>
              <div className="space-y-1.5">
                {onFire.slice(0, 8).map((w) => (
                  <Link key={w.id} href={`/roster/${w.slug ?? w.id}`} className="flex items-center gap-2 rounded-lg border border-amber-500/10 bg-amber-500/[0.03] px-2 py-1.5 hover:border-amber-500/25 transition-all group">
                    {w.image ? (
                      <img src={w.image} alt="" className="h-7 w-7 rounded-full object-cover border border-amber-500/20 shrink-0" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-[11px] font-semibold truncate flex-1 group-hover:text-gold transition-colors">{w.name}</span>
                    <span className="text-[9px] font-bold text-amber-400 shrink-0">
                      {Array.from({ length: Math.min(w.streak, 3) }).map((_, i) => "🔥").join("")} {w.streak}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Ice Cold (own column) */}
          {iceCold.length > 0 && (
            <div className="max-h-[400px] overflow-y-auto">
              <h3 className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-2 flex items-center gap-1">
                <span>🧊</span> Ice Cold
              </h3>
              <div className="space-y-1.5">
                {iceCold.slice(0, 8).map((w) => (
                  <Link key={w.id} href={`/roster/${w.slug ?? w.id}`} className="flex items-center gap-2 rounded-lg border border-blue-500/10 bg-blue-500/[0.03] px-2 py-1.5 hover:border-blue-500/25 transition-all group">
                    {w.image ? (
                      <img src={w.image} alt="" className="h-7 w-7 rounded-full object-cover border border-blue-500/20 grayscale-[30%] shrink-0" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-[11px] font-semibold truncate flex-1 group-hover:text-blue-400 transition-colors">{w.name}</span>
                    <span className="text-[9px] font-bold text-blue-400 shrink-0">
                      {Array.from({ length: Math.min(Math.abs(w.streak), 3) }).map((_, i) => "🧊").join("")} {Math.abs(w.streak)}L
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
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-3 flex items-center gap-1.5">
              <span>⚡</span> Power Rankings
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
                      <span className="text-[8px] uppercase tracking-wider text-gold/30 font-bold w-8 text-right">PWR</span>
                    </div>
                    <div className="space-y-1.5">
                    {menRankings.map((w, i) => (
                      <Link key={w.id} href={`/roster/${w.slug ?? w.id}`} className="flex items-center gap-2 group">
                        <span className={`text-sm font-black tabular-nums w-5 text-right ${i === 0 ? "text-gold" : i < 3 ? "text-foreground/60" : "text-muted-foreground/30"}`}>{i + 1}</span>
                        {w.image ? (
                          <img src={w.image} alt="" className="h-7 w-7 rounded-full object-cover border border-border/20 shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                          </div>
                        )}
                        <span className="text-xs font-semibold truncate flex-1 group-hover:text-gold transition-colors">{w.name}</span>
                        <span className="text-[10px] tabular-nums text-foreground/60 shrink-0">{w.wins}W-{w.losses}L</span>
                        <span className="text-[9px] tabular-nums text-gold/50 font-bold shrink-0 w-8 text-right">{w.pwr}</span>
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
                      <span className="text-[8px] uppercase tracking-wider text-gold/30 font-bold w-8 text-right">PWR</span>
                    </div>
                    <div className="space-y-1.5">
                    {womenRankings.map((w, i) => (
                      <Link key={w.id} href={`/roster/${w.slug ?? w.id}`} className="flex items-center gap-2 group">
                        <span className={`text-sm font-black tabular-nums w-5 text-right ${i === 0 ? "text-gold" : i < 3 ? "text-foreground/60" : "text-muted-foreground/30"}`}>{i + 1}</span>
                        {w.image ? (
                          <img src={w.image} alt="" className="h-7 w-7 rounded-full object-cover border border-border/20 shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                          </div>
                        )}
                        <span className="text-xs font-semibold truncate flex-1 group-hover:text-gold transition-colors">{w.name}</span>
                        <span className="text-[10px] tabular-nums text-foreground/60 shrink-0">{w.wins}W-{w.losses}L</span>
                        <span className="text-[9px] tabular-nums text-gold/50 font-bold shrink-0 w-8 text-right">{w.pwr}</span>
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
                          <Link key={w.id} href="/tag-teams" className="flex items-center gap-2 group">
                            <span className={`text-sm font-black tabular-nums w-5 text-right ${i === 0 ? "text-gold" : "text-muted-foreground/30"}`}>{i + 1}</span>
                            {w.memberImages ? (
                              <div className="flex -space-x-1.5 shrink-0">
                                {w.memberImages[0] ? (
                                  <img src={w.memberImages[0]} alt="" className="h-6 w-6 rounded-full object-cover border border-background shrink-0 relative z-10" />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-muted/30 border border-background shrink-0 relative z-10" />
                                )}
                                {w.memberImages[1] ? (
                                  <img src={w.memberImages[1]} alt="" className="h-6 w-6 rounded-full object-cover border border-background shrink-0" />
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
                            <span className="text-[9px] tabular-nums text-gold/50 font-bold shrink-0 w-8 text-right">{w.pwr}</span>
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
                          <Link key={w.id} href="/tag-teams" className="flex items-center gap-2 group">
                            <span className={`text-sm font-black tabular-nums w-5 text-right ${i === 0 ? "text-gold" : "text-muted-foreground/30"}`}>{i + 1}</span>
                            {w.memberImages ? (
                              <div className="flex -space-x-1.5 shrink-0">
                                {w.memberImages[0] ? (
                                  <img src={w.memberImages[0]} alt="" className="h-6 w-6 rounded-full object-cover border border-background shrink-0 relative z-10" />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-muted/30 border border-background shrink-0 relative z-10" />
                                )}
                                {w.memberImages[1] ? (
                                  <img src={w.memberImages[1]} alt="" className="h-6 w-6 rounded-full object-cover border border-background shrink-0" />
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
                            <span className="text-[9px] tabular-nums text-gold/50 font-bold shrink-0 w-8 text-right">{w.pwr}</span>
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

        {/* ── Recent Results + Tier Map Row ─────────────────────────── */}
        <div className={`grid gap-4 ${tierProgress.length > 0 && recentMatches.length > 0 ? "lg:grid-cols-2" : ""}`}>
          {/* Recent Results */}
          {recentMatches.length > 0 && (
            <Card className="border-border/30 bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                  Recent Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
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
                    <div key={m.id} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/5 transition-colors">
                      {/* A photo */}
                      {aImgs ? (
                        <div className="flex -space-x-1.5 shrink-0">
                          {aImgs[0] ? <img src={aImgs[0]} alt="" className="h-6 w-6 rounded-full object-cover border border-background relative z-10" /> : <div className="h-6 w-6 rounded-full bg-muted/30 border border-background relative z-10" />}
                          {aImgs[1] ? <img src={aImgs[1]} alt="" className="h-6 w-6 rounded-full object-cover border border-background" /> : <div className="h-6 w-6 rounded-full bg-muted/30 border border-background" />}
                        </div>
                      ) : aImg ? (
                        <img src={aImg} alt="" className="h-6 w-6 rounded-full object-cover border border-border/20 shrink-0" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-bold text-muted-foreground/30">{aName.charAt(0)}</span>
                        </div>
                      )}
                      {isTag ? (
                        <Link href="/tag-teams" className={`truncate hover:underline ${isAWinner ? "font-semibold text-gold" : "text-muted-foreground/60"}`}>
                          {aName}<span className="text-[9px] text-muted-foreground/40 font-normal ml-1">({winCounts.get(aId ?? "") ?? 0}-{lossCounts.get(aId ?? "") ?? 0})</span>
                        </Link>
                      ) : (
                        <Link href={`/roster/${slugMap[aId ?? ""] ?? aId}`} className={`truncate hover:underline ${isAWinner ? "font-semibold text-gold" : "text-muted-foreground/60"}`}>
                          {aName}<span className="text-[9px] text-muted-foreground/40 font-normal ml-1">({winCounts.get(aId ?? "") ?? 0}-{lossCounts.get(aId ?? "") ?? 0})</span>
                        </Link>
                      )}
                      <span className="text-[9px] text-muted-foreground/30 shrink-0">vs</span>
                      {isTag ? (
                        <Link href="/tag-teams" className={`truncate hover:underline ${!isAWinner ? "font-semibold text-gold" : "text-muted-foreground/60"}`}>
                          {bName}<span className="text-[9px] text-muted-foreground/40 font-normal ml-1">({winCounts.get(bId ?? "") ?? 0}-{lossCounts.get(bId ?? "") ?? 0})</span>
                        </Link>
                      ) : (
                        <Link href={`/roster/${slugMap[bId ?? ""] ?? bId}`} className={`truncate hover:underline ${!isAWinner ? "font-semibold text-gold" : "text-muted-foreground/60"}`}>
                          {bName}<span className="text-[9px] text-muted-foreground/40 font-normal ml-1">({winCounts.get(bId ?? "") ?? 0}-{lossCounts.get(bId ?? "") ?? 0})</span>
                        </Link>
                      )}
                      {/* B photo */}
                      {bImgs ? (
                        <div className="flex -space-x-1.5 shrink-0">
                          {bImgs[0] ? <img src={bImgs[0]} alt="" className="h-6 w-6 rounded-full object-cover border border-background relative z-10" /> : <div className="h-6 w-6 rounded-full bg-muted/30 border border-background relative z-10" />}
                          {bImgs[1] ? <img src={bImgs[1]} alt="" className="h-6 w-6 rounded-full object-cover border border-background" /> : <div className="h-6 w-6 rounded-full bg-muted/30 border border-background" />}
                        </div>
                      ) : bImg ? (
                        <img src={bImg} alt="" className="h-6 w-6 rounded-full object-cover border border-border/20 shrink-0" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-bold text-muted-foreground/30">{bName.charAt(0)}</span>
                        </div>
                      )}
                      <span className="ml-auto flex items-center gap-2 shrink-0">
                        {time && <span className="text-[10px] tabular-nums text-muted-foreground/40">{time}</span>}
                        {matchIdx === 0 && (
                          <UndoMatchButton matchId={m.id} winnerName={wrestlerMap[winnerId ?? ""] ?? "?"} />
                        )}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Tier Progress Map */}
          {tierProgress.length > 0 && (
            <Card className="border-border/30 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                  Tier Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
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
                          <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${c.text}`}>{g.label}</span>
                        </div>
                        <div className="grid gap-1 grid-cols-4">
                          {g.tiers.map((t) => {
                            const pct = t.total > 0 ? Math.round((t.played / t.total) * 100) : 0;
                            const done = pct === 100;
                            return (
                              <Link key={t.tierId} href={`/tiers/${t.tierSlug ?? t.tierId}`}>
                                <div
                                  className={`rounded border p-1.5 text-center hover:scale-105 transition-all relative overflow-hidden ${
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
                                  <span className="text-[8px] font-bold block truncate relative z-10">{t.tierName}</span>
                                  <span className={`text-[7px] font-bold tabular-nums relative z-10 ${
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
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Championship Belt Gallery ───────────────────────────────── */}
        {champions.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-3 flex items-center gap-1.5">
              <span>🏆</span> Championship Holders
            </h2>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {champions.sort((a, b) => a.tierNumber - b.tierNumber).map((c) => (
                <div key={c.tierName} className="group rounded-xl border border-border/30 bg-gradient-to-b from-card to-muted/5 p-3 hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5 transition-all text-center">
                  {c.beltImageUrl ? (
                    <img src={c.beltImageUrl} alt={c.tierName} className="h-12 w-full object-contain mx-auto mb-2 opacity-80 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="h-12 flex items-center justify-center mb-2">
                      <span className="text-2xl opacity-30 group-hover:opacity-60 transition-opacity">🏆</span>
                    </div>
                  )}
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 truncate">{c.tierName}</p>
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    {imageMap[c.holderId] ? (
                      <img src={imageMap[c.holderId]} alt="" className="h-5 w-5 rounded-full object-cover border border-border/20" />
                    ) : null}
                    <p className="text-xs font-bold truncate text-gold">{c.holderName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier Heat Map moved to sidebar with Recent Results */}

        {/* ── Stats Bar ──────────────────────────────────────────────── */}
        <div className="grid gap-3 grid-cols-3">
          <div className="rounded-lg border border-border/20 bg-card/30 px-4 py-3 text-center">
            <p className="text-2xl font-black tabular-nums">{wrestlerCount ?? 0}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 font-semibold">Wrestlers</p>
          </div>
          <div className="rounded-lg border border-border/20 bg-card/30 px-4 py-3 text-center">
            <p className="text-2xl font-black tabular-nums">{tagTeamCount ?? 0}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 font-semibold">Tag Teams</p>
          </div>
          <div className="rounded-lg border border-border/20 bg-card/30 px-4 py-3 text-center">
            <p className="text-2xl font-black tabular-nums">{completedSeasons ?? 0}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 font-semibold">Seasons</p>
          </div>
        </div>

        {/* ── Empty State ────────────────────────────────────────────── */}
        {playedMatches.length === 0 && !season && (
          <div className="rounded-2xl border border-dashed border-border/30 bg-gradient-to-br from-card/50 to-muted/5 px-6 py-16 text-center">
            <img src="/logo.svg" alt="" width={56} height={56} className="mx-auto mb-4 opacity-40" />
            <h3 className="text-xl font-bold">Ready to Begin</h3>
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
