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
import { computeMilestones } from "@/lib/milestones";

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
    supabase.from("wrestlers").select("id, name, image_url, overall_rating, slug"),
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

  // ── Season-specific data ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allMatchData: any[] = [];
  let tagMemberImages: Record<string, [string | null, string | null]> = {};
  let tierProgress: Array<{
    tierId: string;
    tierSlug: string | null;
    tierNumber: number;
    tierName: string;
    tierColor: string | null;
    played: number;
    total: number;
  }> = [];
  let totalPlayed = 0;
  let totalMatches = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tiersData: any[] = [];

  if (season) {
    const [{ data: allMatches }, { data: tiers }, { data: tagTeamNames }] = await Promise.all([
      supabase
        .from("matches")
        .select("id, wrestler_a_id, wrestler_b_id, tag_team_a_id, tag_team_b_id, winner_wrestler_id, winner_tag_team_id, stipulation, match_phase, match_time_seconds, tier_id, played_at")
        .eq("season_id", season.id)
        .order("played_at", { ascending: false }),
      supabase
        .from("tiers")
        .select("id, tier_number, name, short_name, color, belt_image_url, slug, divisions(name, gender)")
        .order("tier_number"),
      supabase.from("tag_teams").select("id, name, wrestler_a:wrestlers!tag_teams_wrestler_a_id_fkey(image_url), wrestler_b:wrestlers!tag_teams_wrestler_b_id_fkey(image_url)"),
    ]);

    allMatchData = allMatches ?? [];
    tiersData = tiers ?? [];

    for (const t of tagTeamNames ?? []) {
      wrestlerMap[t.id] = t.name;
      const wa = t.wrestler_a as unknown as { image_url: string | null } | null;
      const wb = t.wrestler_b as unknown as { image_url: string | null } | null;
      tagMemberImages[t.id] = [wa?.image_url ?? null, wb?.image_url ?? null];
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
        return {
          tierId: t.id,
          tierSlug: t.slug ?? null,
          tierNumber: t.tier_number,
          tierName: t.short_name || t.name,
          tierColor: t.color,
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
    image: string | null;
    memberImages?: [string | null, string | null];
    wins: number;
    losses: number;
    overallRating: number | null;
    streak: number;
  }> = {};
  const allParticipantIds = new Set<string>();
  for (const m of unplayedMatches) {
    const aId = m.wrestler_a_id || m.tag_team_a_id;
    const bId = m.wrestler_b_id || m.tag_team_b_id;
    if (aId) allParticipantIds.add(aId);
    if (bId) allParticipantIds.add(bId);
  }
  for (const id of allParticipantIds) {
    const isTagTeam = !!(tagMemberImages ?? {})[id];
    upNextParticipantStats[id] = {
      name: wrestlerMap[id] ?? "?",
      image: imageMap[id] ?? null,
      ...(isTagTeam && tagMemberImages[id] ? { memberImages: tagMemberImages[id] } : {}),
      wins: winCounts.get(id) ?? 0,
      losses: lossCounts.get(id) ?? 0,
      overallRating: ratingMap[id] ?? null,
      streak: fullStreaks.get(id) ?? 0,
    };
  }

  const upNextTiers = tiersData.map((t: { id: string; tier_number: number; name: string; short_name: string | null; slug: string | null }) => ({
    id: t.id,
    tier_number: t.tier_number,
    name: t.short_name || t.name,
    slug: t.slug ?? null,
  }));

  // ── Recent Results ────────────────────────────────────────────────────────
  const recentMatches = playedMatches.slice(0, 8);

  // ── Power Rankings (top 5 by wins) ────────────────────────────────────────
  const powerRankings = Array.from(winCounts.entries())
    .map(([id, wins]) => ({
      id,
      slug: slugMap[id] ?? null,
      name: wrestlerMap[id] ?? "?",
      image: imageMap[id] ?? null,
      wins,
      losses: lossCounts.get(id) ?? 0,
      winPct: wins / ((wins + (lossCounts.get(id) ?? 0)) || 1),
    }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.winPct - a.winPct;
    })
    .slice(0, 5);

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
                CPU-vs-CPU championship simulation across 28 tiers with promotion, relegation, and dynasty tracking.
              </p>
            </div>

            {/* Season Progress Ring */}
            {season && totalMatches > 0 && (
              <div className="flex items-center gap-6">
                <div className="relative h-32 w-32 shrink-0">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/10" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${overallPct * 2.64} 264`}
                      className={overallPct === 100 ? "text-emerald-500" : "text-gold"}
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
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Roster:</span>
                    <span className="font-bold tabular-nums">{wrestlerCount ?? 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container max-w-screen-2xl px-4 py-6 space-y-8">

        {/* ── Milestones ──────────────────────────────────────────────── */}
        {milestones.length > 0 && <MilestonesBanner milestones={milestones} />}

        {/* ── Upcoming Match (Random Picker) ──────────────────────────── */}
        {unplayedMatches.length > 0 && (
          <UpNextCard
            matches={unplayedMatches}
            participantStats={upNextParticipantStats}
            tiers={upNextTiers}
            remainingCount={unplayedMatches.length}
          />
        )}

        {/* ── Featured Match ─────────────────────────────────────────── */}
        {featuredMatch && (
          <div className="rounded-2xl border border-border/30 bg-gradient-to-r from-card via-card to-card overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.03] via-transparent to-purple-500/[0.03]" />
            <div className="relative px-6 py-5">
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">
                Latest Result
              </div>
              <div className="flex items-center justify-center gap-4 sm:gap-8">
                {/* Wrestler A */}
                {(() => {
                  const aId = featuredMatch.wrestler_a_id || featuredMatch.tag_team_a_id;
                  const winnerId = featuredMatch.winner_wrestler_id || featuredMatch.winner_tag_team_id;
                  const isWinner = winnerId === aId;
                  const name = wrestlerMap[aId ?? ""] ?? "?";
                  const img = imageMap[aId ?? ""];
                  return (
                    <div className={`flex flex-col items-center gap-2 flex-1 max-w-[180px] ${isWinner ? "" : "opacity-50"}`}>
                      {img ? (
                        <img src={img} alt={name} className={`h-16 w-16 rounded-full object-cover border-2 ${isWinner ? "border-gold shadow-lg shadow-gold/20" : "border-border/30"}`} />
                      ) : (
                        <div className={`h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold ${isWinner ? "bg-gold/10 border-2 border-gold text-gold" : "bg-muted/20 border-2 border-border/30 text-muted-foreground/30"}`}>
                          {name.charAt(0)}
                        </div>
                      )}
                      <span className={`text-sm font-bold text-center leading-tight ${isWinner ? "text-gold" : "text-muted-foreground/50"}`}>
                        {name}
                      </span>
                      {isWinner && <span className="text-[9px] font-bold uppercase tracking-widest text-gold/60">Winner</span>}
                    </div>
                  );
                })()}

                {/* VS */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <span className="text-2xl font-black text-muted-foreground/10">VS</span>
                  {featuredMatch.match_time_seconds && (
                    <span className="text-[10px] tabular-nums text-muted-foreground/30">{formatTime(featuredMatch.match_time_seconds)}</span>
                  )}
                  {featuredMatch.stipulation && (
                    <Badge className="bg-wwe-red/10 text-wwe-red/60 text-[8px] border-0">{featuredMatch.stipulation}</Badge>
                  )}
                </div>

                {/* Wrestler B */}
                {(() => {
                  const bId = featuredMatch.wrestler_b_id || featuredMatch.tag_team_b_id;
                  const winnerId = featuredMatch.winner_wrestler_id || featuredMatch.winner_tag_team_id;
                  const isWinner = winnerId === bId;
                  const name = wrestlerMap[bId ?? ""] ?? "?";
                  const img = imageMap[bId ?? ""];
                  return (
                    <div className={`flex flex-col items-center gap-2 flex-1 max-w-[180px] ${isWinner ? "" : "opacity-50"}`}>
                      {img ? (
                        <img src={img} alt={name} className={`h-16 w-16 rounded-full object-cover border-2 ${isWinner ? "border-gold shadow-lg shadow-gold/20" : "border-border/30"}`} />
                      ) : (
                        <div className={`h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold ${isWinner ? "bg-gold/10 border-2 border-gold text-gold" : "bg-muted/20 border-2 border-border/30 text-muted-foreground/30"}`}>
                          {name.charAt(0)}
                        </div>
                      )}
                      <span className={`text-sm font-bold text-center leading-tight ${isWinner ? "text-gold" : "text-muted-foreground/50"}`}>
                        {name}
                      </span>
                      {isWinner && <span className="text-[9px] font-bold uppercase tracking-widest text-gold/60">Winner</span>}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── On Fire Section ────────────────────────────────────────── */}
        {onFire.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-3 flex items-center gap-1.5">
              <span>🔥</span> On Fire
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {onFire.map((w) => (
                <Link key={w.id} href={`/roster/${w.slug ?? w.id}`} className="shrink-0">
                  <div className="w-[130px] rounded-xl border border-border/30 bg-gradient-to-b from-card to-muted/5 p-3 hover:border-gold/30 hover:shadow-md hover:shadow-gold/5 transition-all">
                    <div className="flex justify-center mb-2">
                      {w.image ? (
                        <img src={w.image} alt={w.name} className="h-12 w-12 rounded-full object-cover border border-border/30" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-bold text-center truncate">{w.name}</p>
                    <div className="flex items-center justify-center gap-0.5 mt-1">
                      {Array.from({ length: Math.min(w.streak, 5) }).map((_, i) => (
                        <span key={i} className="text-[10px]">🔥</span>
                      ))}
                      <span className="text-[10px] font-bold text-amber-400 ml-0.5">{w.streak}</span>
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground/50 tabular-nums mt-0.5">
                      {w.wins}W-{w.losses}L
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Main Grid: Rankings + Recent Results ────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Power Rankings */}
          {powerRankings.length > 0 && (
            <Card className="border-border/30 bg-card/50 lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/50 flex items-center gap-1.5">
                  <span>⚡</span> Power Rankings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {powerRankings.map((w, i) => (
                  <Link key={w.id} href={`/roster/${w.slug ?? w.id}`} className="flex items-center gap-3 group">
                    <span className={`text-lg font-black tabular-nums w-6 text-right ${i === 0 ? "text-gold" : i === 1 ? "text-foreground/60" : "text-muted-foreground/30"}`}>
                      {i + 1}
                    </span>
                    {w.image ? (
                      <img src={w.image} alt="" className="h-8 w-8 rounded-full object-cover border border-border/20 shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-muted-foreground/30">{w.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate group-hover:text-gold transition-colors">{w.name}</p>
                      <p className="text-[10px] text-muted-foreground/50 tabular-nums">{w.wins}W-{w.losses}L · {(w.winPct * 100).toFixed(0)}%</p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent Results */}
          {recentMatches.length > 0 && (
            <Card className="border-border/30 bg-card/50 lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                  Recent Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {recentMatches.map((m) => {
                  const aId = m.wrestler_a_id || m.tag_team_a_id;
                  const bId = m.wrestler_b_id || m.tag_team_b_id;
                  const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
                  const aName = wrestlerMap[aId ?? ""] ?? "?";
                  const bName = wrestlerMap[bId ?? ""] ?? "?";
                  const isAWinner = winnerId === aId;
                  const time = m.match_time_seconds ? formatTime(m.match_time_seconds) : null;
                  return (
                    <div key={m.id} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/5 transition-colors">
                      <span className={`truncate ${isAWinner ? "font-semibold text-gold" : "text-muted-foreground/60"}`}>{aName}</span>
                      <span className="text-[9px] text-muted-foreground/30 shrink-0">vs</span>
                      <span className={`truncate ${!isAWinner ? "font-semibold text-gold" : "text-muted-foreground/60"}`}>{bName}</span>
                      <span className="ml-auto flex items-center gap-2 shrink-0">
                        {time && <span className="text-[10px] tabular-nums text-muted-foreground/30">{time}</span>}
                        <Badge variant="outline" className="text-[8px] uppercase tracking-wider border-border/20 px-1.5">{m.match_phase.replace("_", " ")}</Badge>
                      </span>
                    </div>
                  );
                })}
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

        {/* ── Tier Heat Map ───────────────────────────────────────────── */}
        {tierProgress.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-3">
              Tier Progress
            </h2>
            <div className="grid gap-1.5 grid-cols-4 sm:grid-cols-7 lg:grid-cols-14">
              {tierProgress.map((t) => {
                const pct = t.total > 0 ? Math.round((t.played / t.total) * 100) : 0;
                const bgOpacity = pct === 100 ? "bg-emerald-500/15 border-emerald-500/20" : pct > 0 ? "bg-gold/10 border-gold/15" : "bg-muted/5 border-border/20";
                return (
                  <Link key={t.tierId} href={`/tiers/${t.tierSlug ?? t.tierId}`}>
                    <div className={`rounded-lg border p-2 text-center hover:scale-105 transition-all ${bgOpacity}`} title={`${t.tierName}: ${pct}%`}>
                      <span className="text-[9px] font-bold block truncate">{t.tierName}</span>
                      <span className={`text-[8px] font-bold tabular-nums ${pct === 100 ? "text-emerald-400" : pct > 0 ? "text-gold/70" : "text-muted-foreground/30"}`}>
                        {pct}%
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

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
