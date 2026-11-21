import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAllAssignments,
  getAllMatches,
  getChampions,
  getCurrentSeason,
  getTagTeams,
  getTiers,
  getWrestlers,
} from "@/lib/data/cached";
import { buildEloBoard, rankTimeline, POOL_LABEL } from "@/lib/elo/board";
import { BASE_RATING, winProbability } from "@/lib/elo/compute-elo";
import { buildTagSeason, ordinal } from "@/lib/tag-teams/season";
import { tierColor } from "@/lib/tiers/colors";
import { EloMoveChip } from "@/components/ui/elo-move";
import { RatingSparkline } from "@/components/ui/rating-sparkline";
import { SmartImage, displaySrc } from "@/components/ui/smart-image";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    pool_play: "Pool Play",
    quarterfinal: "Quarterfinal",
    semifinal: "Semifinal",
    final: "Final",
    relegation: "Relegation",
  };
  return labels[phase] ?? phase;
}

interface Member {
  id: string;
  name: string;
  image_url: string | null;
  gender: string | null;
  slug?: string | null;
}

export default async function TagTeamProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [teams, allMatchRows, allAssignRows, currentSeason, champions, allWrestlers, tiers] =
    await Promise.all([
      getTagTeams(),
      getAllMatches(),
      getAllAssignments(),
      getCurrentSeason(),
      getChampions(),
      getWrestlers(),
      getTiers(),
    ]);

  const team = teams.find((t) => t.id === id);
  if (!team) notFound();

  const memberA = team.wrestler_a as unknown as Member | null;
  const memberB = team.wrestler_b as unknown as Member | null;
  const teamGender = memberA?.gender ?? "male";
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  // ── Matches ───────────────────────────────────────────────────────────────
  const teamMatches = allMatchRows.filter(
    (m) => m.tag_team_a_id === id || m.tag_team_b_id === id
  );
  const played = teamMatches
    .filter((m) => m.played_at && m.winner_tag_team_id)
    .sort((a, b) => {
      const sA = a.seasons?.season_number ?? 0;
      const sB = b.seasons?.season_number ?? 0;
      if (sB !== sA) return sB - sA;
      return new Date(b.played_at!).getTime() - new Date(a.played_at!).getTime();
    });

  const wins = played.filter((m) => m.winner_tag_team_id === id).length;
  const losses = played.length - wins;
  const winPct = played.length > 0 ? ((wins / played.length) * 100).toFixed(1) : null;

  const titlesWon = played.filter(
    (m) => m.match_phase === "final" && m.winner_tag_team_id === id
  );
  const playoffMatches = played.filter((m) =>
    ["quarterfinal", "semifinal", "final"].includes(m.match_phase)
  );
  const playoffWins = playoffMatches.filter((m) => m.winner_tag_team_id === id).length;
  const poolMatches = played.filter((m) => m.match_phase === "pool_play");
  const poolWins = poolMatches.filter((m) => m.winner_tag_team_id === id).length;

  // Streaks (chronological)
  const chrono = [...played].reverse();
  let currentStreak = 0;
  let bestStreak = 0;
  let run = 0;
  for (const m of chrono) {
    if (m.winner_tag_team_id === id) {
      run++;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
  }
  for (const m of played) {
    const won = m.winner_tag_team_id === id;
    if (currentStreak === 0) currentStreak = won ? 1 : -1;
    else if (currentStreak > 0 && won) currentStreak++;
    else if (currentStreak < 0 && !won) currentStreak--;
    else break;
  }

  const timedWins = played.filter(
    (m) => m.winner_tag_team_id === id && (m.match_time_seconds ?? 0) > 0
  );
  const fastestWin = timedWins.length
    ? Math.min(...timedWins.map((m) => m.match_time_seconds!))
    : null;
  const timed = played.filter((m) => (m.match_time_seconds ?? 0) > 0);
  const avgTime = timed.length
    ? Math.round(timed.reduce((s, m) => s + m.match_time_seconds!, 0) / timed.length)
    : null;

  const opponentOf = (m: (typeof played)[0]) =>
    m.tag_team_a_id === id ? m.tag_team_b_id! : m.tag_team_a_id!;
  const uniqueOpponents = new Set(played.map(opponentOf)).size;

  // ── Elo ───────────────────────────────────────────────────────────────────
  const eloBoard = buildEloBoard(allMatchRows, allWrestlers, teams);
  const eloEntry = eloBoard.entries.get(id) ?? null;
  const eloRanks = eloEntry
    ? rankTimeline(allMatchRows, allWrestlers, teams, id, eloEntry.history)
    : [];
  const eloStanding = eloBoard.standings.get(id) ?? null;
  const eloRank = eloStanding?.rank ?? null;

  // ── Head-to-head ──────────────────────────────────────────────────────────
  const h2h = new Map<string, { wins: number; losses: number }>();
  for (const m of played) {
    const opp = opponentOf(m);
    if (!h2h.has(opp)) h2h.set(opp, { wins: 0, losses: 0 });
    if (m.winner_tag_team_id === id) h2h.get(opp)!.wins++;
    else h2h.get(opp)!.losses++;
  }
  const topH2H = [...h2h.entries()]
    .sort((a, b) => b[1].wins + b[1].losses - (a[1].wins + a[1].losses))
    .slice(0, 8);

  // ── Tier history & upcoming ───────────────────────────────────────────────
  const tierHistory = allAssignRows
    .filter((a) => a.tag_team_id === id)
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  const upcoming = currentSeason
    ? teamMatches.filter((m) => m.season_id === currentSeason.id && !m.played_at)
    : [];

  const reigning = champions[id];

  // ── This season ───────────────────────────────────────────────────────────
  const tagSeason = buildTagSeason(
    tiers,
    currentSeason ? allAssignRows.filter((a) => a.season_id === currentSeason.id) : [],
    currentSeason ? allMatchRows.filter((m) => m.season_id === currentSeason.id) : []
  );
  const place = tagSeason.places.get(id) ?? null;
  const plate = place ? tierColor(place.tier.slug ?? place.tier.name) : null;
  const ratingOf = (teamId: string) =>
    eloBoard.standings.get(teamId)?.rating ??
    Math.round(eloBoard.seeds.get(teamId) ?? BASE_RATING);
  const myRating = ratingOf(id);
  const chanceVs = (oppId: string) =>
    Math.round(winProbability(myRating, ratingOf(oppId)) * 100);
  const nextMatch = upcoming[0] ?? null;

  const status = !place
    ? null
    : place.zone === "playoff"
      ? { label: "In a playoff place", tone: "text-gold" }
      : place.zone === "wildcard"
        ? { label: "Holding a wild card", tone: "text-gold" }
        : place.zone === "relplayoff"
        ? { label: "Steel cage place", tone: "text-amber-500" }
        : place.zone === "autorel"
          ? { label: "Drop zone", tone: "text-red-400" }
          : { label: "Outside the playoffs", tone: "text-foreground" };

  // ── Members ───────────────────────────────────────────────────────────────
  const wrestlerById = new Map(allWrestlers.map((w) => [w.id, w]));
  const members = [team.wrestler_a_id, team.wrestler_b_id].map((wid) => {
    const w = wrestlerById.get(wid) ?? null;
    const standing = eloBoard.standings.get(wid) ?? null;
    const assignment = currentSeason
      ? allAssignRows.find((a) => a.wrestler_id === wid && a.season_id === currentSeason.id)
      : null;
    return { w, standing, tier: assignment?.tiers ?? null };
  });

  const imagesOf = (teamId: string) => {
    const t = teamById.get(teamId);
    return [t?.wrestler_a, t?.wrestler_b].map(
      (m) => (m as unknown as Member | null)?.image_url ?? null
    );
  };

  const memberLink = (m: Member | null) =>
    m ? (
      <Link
        href={`/roster/${wrestlerById.get(m.id)?.slug ?? m.id}`}
        className="font-medium text-foreground hover:text-gold transition-colors"
      >
        {m.name}
      </Link>
    ) : (
      <span>?</span>
    );

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <Link
        href="/tag-teams"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Tag Teams
      </Link>

      {/* Header */}
      <div className="cut-br relative mt-5 mb-[2px] flex flex-wrap items-end gap-x-6 gap-y-4 overflow-hidden bg-card px-5 pt-6 sm:px-8">
        <div aria-hidden="true" className="halftone absolute inset-0" />
        <div className="relative flex items-end -space-x-8 shrink-0 self-end">
          {[memberA, memberB].map((m, i) =>
            m?.image_url ? (
              <SmartImage
                key={i}
                src={m.image_url}
                alt={m.name}
                width={160}
                height={160}
                className={`block h-24 w-24 object-cover object-top sm:h-44 sm:w-44 ${i === 0 ? "relative z-10" : ""}`}
              />
            ) : (
              <div
                key={i}
                className={`h-24 w-24 sm:h-44 sm:w-44 bg-muted/20 flex items-center justify-center ${i === 0 ? "relative z-10" : ""}`}
              >
                <span className="text-xl font-bold text-muted-foreground/20">
                  {m?.name.charAt(0) ?? "?"}
                </span>
              </div>
            )
          )}
        </div>
        <div className="relative min-w-0 flex-[1_1_12rem] pb-2 sm:pb-6">
          <p className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {place && plate && (
              <Link
                href={`/tiers/${place.tier.slug ?? place.tier.id}`}
                className="px-1.5 py-0.5 font-bold tracking-[0.16em] hover:brightness-110"
                style={{ background: plate.bg, color: plate.fg }}
              >
                T{place.tier.tierNumber} · {place.tier.shortName}
              </Link>
            )}
            <span>{teamGender === "female" ? "Women's" : "Men's"} tag</span>
            {!team.is_active && <span className="text-muted-foreground/60">· Inactive</span>}
          </p>
          <h1 className="text-3xl [overflow-wrap:anywhere] sm:text-6xl">
            {eloRank != null && (
              <span className="mr-3 text-2xl text-gold sm:text-4xl" title={`Ranked #${eloRank} in ${POOL_LABEL[eloStanding!.pool]} by Elo`}>
                {eloRank}
              </span>
            )}
            {team.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {memberLink(memberA)} <span className="text-muted-foreground/40">&amp;</span> {memberLink(memberB)}
          </p>
          {reigning && (
            <p className="mt-2 inline-block bg-gold px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-black">
              Reigning {reigning.beltName} Champions
            </p>
          )}
        </div>
        {eloStanding && (
          <div className="relative w-full pb-6 sm:w-auto sm:text-right">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Elo · {POOL_LABEL[eloStanding.pool]} #{eloStanding.rank} of {eloStanding.poolSize}
            </p>
            <p className="font-display text-6xl font-black leading-none text-gold sm:text-7xl">
              {eloStanding.rating}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              peak {eloStanding.peak}
              {eloStanding.lastDelta !== 0 && (
                <span className={eloStanding.lastDelta > 0 ? "ml-2 text-emerald-400" : "ml-2 text-red-400"}>
                  {eloStanding.lastDelta > 0 ? "+" : ""}{eloStanding.lastDelta} last match
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid gap-[2px] grid-cols-2 md:grid-cols-4">
        <StatCard label="Career Record">
          <p className="font-display mt-1 text-5xl font-black leading-none">
            <span className={wins > 0 ? "text-emerald-400" : "text-muted-foreground/40"}>{wins}</span>
            <span className="text-muted-foreground/40 mx-1">-</span>
            <span className={losses > 0 ? "text-red-400" : "text-muted-foreground/40"}>{losses}</span>
          </p>
          {winPct && <p className="mt-0.5 text-xs text-muted-foreground">{winPct}% win rate</p>}
        </StatCard>
        <StatCard label="Championships" value={titlesWon.length.toString()} highlight={titlesWon.length > 0} />
        <StatCard label="Seasons Played" value={tierHistory.length.toString()} />
        <StatCard
          label="Current Streak"
          value={currentStreak > 0 ? `${currentStreak}W` : currentStreak < 0 ? `${Math.abs(currentStreak)}L` : "—"}
        />
      </div>

      {/* This season */}
      {place && plate && status && (
        <div className="mt-[2px] flex flex-col bg-card sm:flex-row">
          <div
            className="flex shrink-0 items-center gap-3 px-5 py-3 sm:w-56 sm:flex-col sm:items-start sm:justify-center sm:gap-1"
            style={{ background: plate.bg, color: plate.fg }}
          >
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
              Season {currentSeason?.season_number}
            </span>
            <span className="font-display text-5xl font-black leading-none">
              {ordinal(place.poolPlace)}
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">
              {place.pool ? `Pool ${place.pool} · ` : ""}of {place.poolSize}
            </span>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 lg:grid-cols-4">
            <SeasonFact label="Championship">
              <Link
                href={`/tiers/${place.tier.slug ?? place.tier.id}`}
                className="hover:text-gold"
              >
                {place.tier.shortName}
              </Link>
            </SeasonFact>
            <SeasonFact label="Pool record">
              <span className="tabular-nums">
                {place.row.wins}-{place.row.losses}
              </span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {ordinal(place.place)} of {place.size} in the tier
              </span>
            </SeasonFact>
            <SeasonFact label="Standing">
              <span className={status.tone}>{status.label}</span>
              {place.zone !== "playoff" && place.zone !== "wildcard" && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {place.gamesBack === 0
                    ? "level with the last place in"
                    : `${place.gamesBack} ${place.gamesBack === 1 ? "game" : "games"} back`}
                </span>
              )}
            </SeasonFact>
            <SeasonFact label="Next match">
              {nextMatch ? (
                <Link href={`/match/${nextMatch.id}`} className="hover:text-gold">
                  {teamNames[opponentOf(nextMatch)] ?? "?"}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {chanceVs(opponentOf(nextMatch))}% to win
                  </span>
                </Link>
              ) : (
                <span className="text-muted-foreground">Pool play complete</span>
              )}
            </SeasonFact>
          </div>
        </div>
      )}

      {/* Elo */}
      {eloEntry && eloEntry.history.length >= 2 && (
        <div className="mt-[2px] bg-card px-5 pb-5 pt-4">
          <div>
            <p className="mb-6 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rating history · hover a match · ◆ title won</p>
            <div className="min-w-0 text-muted-foreground">
              <RatingSparkline
                height={120}
                points={eloEntry.history.map((h, hi) => {
                  const oppImage = imagesOf(h.opponentId)[0];
                  return {
                    rating: h.rating,
                    won: h.won,
                    rank: eloRanks[hi] || undefined,
                    title: h.phase === "final" ? (h.won ? "won" : "lost") : undefined,
                    opponentImage: oppImage ? displaySrc(oppImage, 40) : null,
                    label: `${h.rating} — ${h.won ? "def." : "lost to"} ${teamNames[h.opponentId] ?? "?"}${h.seasonNumber ? ` (S${h.seasonNumber})` : ""}`,
                  };
                })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mini stats */}
      <div className="mt-[2px] grid gap-[2px] grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="Playoff Record" value={playoffMatches.length > 0 ? `${playoffWins}-${playoffMatches.length - playoffWins}` : "—"} />
        <MiniStat label="Pool Play Record" value={poolMatches.length > 0 ? `${poolWins}-${poolMatches.length - poolWins}` : "—"} />
        <MiniStat label="Best Win Streak" value={bestStreak > 0 ? `${bestStreak}` : "—"} />
        <MiniStat label="Fastest Win" value={fastestWin ? formatTime(fastestWin) : "—"} />
        <MiniStat label="Avg Match Time" value={avgTime ? formatTime(avgTime) : "—"} />
        <MiniStat label="Opponents Faced" value={uniqueOpponents > 0 ? `${uniqueOpponents}` : "—"} />
      </div>

      {/* The team */}
      <div className="mt-8">
        <SectionHeader>The Team</SectionHeader>
        <div className="grid grid-cols-1 pl-px pt-px md:grid-cols-2">
          {members.map(({ w, standing, tier }, i) =>
            w ? (
              <Link
                key={w.id}
                href={`/roster/${w.slug ?? w.id}`}
                className="group -ml-px -mt-px flex items-stretch border border-border bg-card"
              >
                <div className="halftone h-28 w-28 shrink-0 overflow-hidden bg-background sm:h-32 sm:w-32">
                  {w.image_url ? (
                    <SmartImage
                      src={w.image_url}
                      alt=""
                      width={160}
                      height={160}
                      className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-display text-5xl font-black text-muted-foreground/15">
                      {w.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                    Singles{tier ? ` · T${tier.tier_number} ${tier.short_name || tier.name}` : " · not entered this season"}
                  </p>
                  <p className="mt-0.5 font-display text-2xl font-extrabold leading-tight [overflow-wrap:anywhere] group-hover:text-gold">
                    {standing && (
                      <span className="mr-2 text-lg text-gold" title={`Ranked #${standing.rank} in ${POOL_LABEL[standing.pool]} singles by Elo`}>
                        {standing.rank}
                      </span>
                    )}
                    {w.name}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
                    {standing ? (
                      <>
                        <span>
                          <span className="font-bold text-gold tabular-nums">{standing.rating}</span> Elo
                        </span>
                        <span className="tabular-nums">
                          {standing.wins}-{standing.losses}
                        </span>
                      </>
                    ) : (
                      <span>No singles matches yet</span>
                    )}
                    {w.overall_rating != null && (
                      <span>
                        <span className="tabular-nums text-foreground">{w.overall_rating}</span> OVR
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            ) : (
              <div key={i} className="-ml-px -mt-px border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                Member not found
              </div>
            )
          )}
        </div>
      </div>

      {/* Championships won */}
      {titlesWon.length > 0 && (
        <div className="mt-8">
          <SectionHeader>Championships Won</SectionHeader>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {titlesWon.map((m) => (
              <div key={m.id} className="min-w-[140px] flex-shrink-0 border border-gold/30 bg-gold/[0.04] p-3">
                {m.tiers?.belt_image_url && (
                  <SmartImage
                    src={m.tiers.belt_image_url}
                    alt=""
                    width={200}
                    height={96}
                    className="h-12 w-auto object-contain mx-auto mb-2"
                  />
                )}
                <p className="text-xs font-bold text-center">{m.tiers?.short_name || m.tiers?.name}</p>
                <p className="text-[10px] text-muted-foreground text-center mt-0.5">
                  Season {m.seasons?.season_number}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-x-6 gap-y-8 lg:grid-cols-2">
        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div>
            <SectionHeader>Still To Wrestle</SectionHeader>
            <div className="border border-border">
              {upcoming.map((m, i) => {
                const oppId = opponentOf(m);
                const oppRank = eloBoard.standings.get(oppId)?.rank ?? null;
                const chance = chanceVs(oppId);
                return (
                  <Link
                    key={m.id}
                    href={`/match/${m.id}`}
                    className={`group flex items-center gap-3 px-3 py-2 hover:bg-foreground/[0.04] ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <TeamFaces images={imagesOf(oppId)} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-gold">
                      {oppRank != null && <span className="mr-1.5 text-xs font-bold text-gold/80">{oppRank}</span>}
                      {teamNames[oppId] ?? "?"}
                    </span>
                    <span className="hidden shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground sm:inline">
                      {ratingOf(oppId)}
                    </span>
                    <span
                      className={`w-14 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums ${
                        chance >= 50 ? "text-emerald-400" : "text-red-400"
                      }`}
                      title="Chance of winning, from the two Elo ratings"
                    >
                      {chance}%
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">
              Win chance from current Elo ratings
            </p>
          </div>
        )}

        <div className="space-y-8">
          {/* Head to head */}
          {topH2H.length > 0 && (
            <div>
              <SectionHeader>Head-to-Head</SectionHeader>
              <div className="border border-border">
                {topH2H.map(([oppId, record], i) => (
                  <Link
                    key={oppId}
                    href={`/tag-teams/${oppId}`}
                    className={`group flex items-center gap-3 px-3 py-2 hover:bg-foreground/[0.04] ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <TeamFaces images={imagesOf(oppId)} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-gold">
                      {teamNames[oppId] ?? "?"}
                    </span>
                    <span className="shrink-0 font-display text-lg font-black tabular-nums leading-none">
                      <span className={record.wins > 0 ? "text-emerald-400" : "text-muted-foreground/40"}>{record.wins}</span>
                      <span className="text-muted-foreground/40 mx-1">-</span>
                      <span className={record.losses > 0 ? "text-red-400" : "text-muted-foreground/40"}>{record.losses}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tier history */}
          {tierHistory.length > 0 && (
            <div>
              <SectionHeader>Tier History</SectionHeader>
              <div className="border border-border">
                {tierHistory.map((a, i) => (
                  <div key={a.id} className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${i > 0 ? "border-t border-border" : ""}`}>
                    <span className="text-muted-foreground">Season {a.seasons?.season_number ?? "?"}</span>
                    <span className="truncate font-medium">
                      <span className="mr-1.5 font-mono text-xs text-muted-foreground">T{a.tiers?.tier_number}</span>
                      {a.tiers?.short_name || a.tiers?.name || "?"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Match history */}
      {played.length > 0 && (
        <div className="mt-8">
          <SectionHeader>Match History</SectionHeader>
          <div className="border border-border">
            {played.map((m, i) => {
              const won = m.winner_tag_team_id === id;
              const oppId = opponentOf(m);
              const both = eloBoard.moves.get(m.id);
              const move = both ? (m.tag_team_a_id === id ? both.a : both.b) : null;
              const stakes = m.match_phase !== "pool_play";
              return (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <span
                    className={`w-6 shrink-0 py-0.5 text-center font-mono text-[10px] font-bold ${
                      won ? "bg-emerald-500 text-black" : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {won ? "W" : "L"}
                  </span>
                  <Link
                    href={`/tag-teams/${oppId}`}
                    className="flex min-w-0 flex-[1_1_10rem] items-center gap-2 text-sm font-medium hover:text-gold"
                  >
                    <TeamFaces images={imagesOf(oppId)} />
                    <span className="truncate">{teamNames[oppId] ?? "?"}</span>
                  </Link>
                  <EloMoveChip move={move} className="shrink-0" />
                  <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:w-72 sm:justify-end">
                    {stakes && (
                      <span className={m.match_phase === "final" ? "bg-gold px-1 font-bold text-black" : "border border-border px-1"}>
                        {phaseLabel(m.match_phase)}
                      </span>
                    )}
                    {m.stipulation && <span className="hidden truncate md:inline">{m.stipulation}</span>}
                    <span className="truncate">
                      {m.tiers?.short_name || m.tiers?.name} · S{m.seasons?.season_number}
                    </span>
                  </span>
                  <Link
                    href={`/match/${m.id}`}
                    className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground hover:text-gold"
                    title="Open the match page"
                  >
                    {m.match_time_seconds ? formatTime(m.match_time_seconds) : "—"}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SeasonFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-base font-bold leading-snug [overflow-wrap:anywhere]">{children}</p>
    </div>
  );
}

/** Two small member portraits for an opposing team */
function TeamFaces({ images }: { images: Array<string | null> }) {
  return (
    <span className="flex shrink-0">
      {images.map((src, i) =>
        src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={i}
            src={displaySrc(src, 40)}
            alt=""
            loading="lazy"
            className="h-7 w-7 bg-muted object-cover object-top"
          />
        ) : (
          <span key={i} className="h-7 w-7 bg-muted" />
        )
      )}
    </span>
  );
}

/* ─── Presentational helpers ─────────────────────────────────────────────── */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="rule-title mb-3 mt-4 text-2xl">{children}</h2>;
}

function StatCard({
  label,
  value,
  highlight,
  children,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      {children ?? (
        <p className={`font-display mt-1 text-5xl font-black leading-none ${highlight ? "text-gold" : ""}`}>{value}</p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/60 px-5 py-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
