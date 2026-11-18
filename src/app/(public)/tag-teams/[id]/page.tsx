import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAllAssignments,
  getAllMatches,
  getChampions,
  getCurrentSeason,
  getTagTeams,
  getWrestlers,
} from "@/lib/data/cached";
import { buildEloBoard, POOL_LABEL } from "@/lib/elo/board";
import { Badge } from "@/components/ui/badge";
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

  const [teams, allMatchRows, allAssignRows, currentSeason, champions, allWrestlers] =
    await Promise.all([
      getTagTeams(),
      getAllMatches(),
      getAllAssignments(),
      getCurrentSeason(),
      getChampions(),
      getWrestlers(),
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
  const longestMatch = timed.length
    ? Math.max(...timed.map((m) => m.match_time_seconds!))
    : null;

  const opponentOf = (m: (typeof played)[0]) =>
    m.tag_team_a_id === id ? m.tag_team_b_id! : m.tag_team_a_id!;
  const uniqueOpponents = new Set(played.map(opponentOf)).size;

  // ── Elo ───────────────────────────────────────────────────────────────────
  const eloBoard = buildEloBoard(allMatchRows, allWrestlers, teams);
  const eloEntry = eloBoard.entries.get(id) ?? null;
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
    .slice(0, 6);

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

  const memberLink = (m: Member | null) =>
    m ? (
      <Link
        href={`/roster/${m.slug ?? m.id}`}
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
          <h1 className="text-3xl [overflow-wrap:anywhere] sm:text-6xl">
            {eloRank != null && (
              <span className="mr-3 text-2xl text-gold sm:text-4xl" title={`Ranked #${eloRank} in ${POOL_LABEL[eloStanding!.pool]} by Elo`}>
                {eloRank}
              </span>
            )}
            {team.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              {teamGender === "female" ? "Women's" : "Men's"} Tag
            </Badge>
            <span className={`inline-flex items-center gap-1 ${team.is_active ? "text-emerald-400" : "text-muted-foreground/50"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${team.is_active ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
              {team.is_active ? "Active" : "Inactive"}
            </span>
            <span className="text-muted-foreground/40">·</span>
            {memberLink(memberA)} <span className="text-muted-foreground/40">&amp;</span> {memberLink(memberB)}
          </p>
          {reigning && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold">
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

      {/* Elo */}
      {eloEntry && eloEntry.history.length >= 2 && (
        <div className="mt-[2px] bg-card px-5 pb-5 pt-4">
          <div>
            <p className="mb-6 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rating history · hover a match</p>
            <div className="min-w-0 text-muted-foreground">
              <RatingSparkline
                height={120}
                points={eloEntry.history.map((h) => {
                  const oppTeam = teamById.get(h.opponentId);
                  const oppImage = (oppTeam?.wrestler_a as unknown as Member | null)?.image_url ?? null;
                  return {
                    rating: h.rating,
                    won: h.won,
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
        <MiniStat label="Longest Match" value={longestMatch ? formatTime(longestMatch) : "—"} />
      </div>

      {/* Championships won */}
      {titlesWon.length > 0 && (
        <div className="mt-8">
          <SectionHeader>Championships Won</SectionHeader>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {titlesWon.map((m) => (
              <div key={m.id} className="flex-shrink-0 rounded-lg border border-gold/20 bg-gold/[0.03] p-3 min-w-[140px]">
                {m.tiers?.belt_image_url ? (
                  <SmartImage
                    src={m.tiers.belt_image_url}
                    alt=""
                    width={200}
                    height={96}
                    className="h-12 w-auto object-contain mx-auto mb-2"
                  />
                ) : (
                  <div className="text-2xl text-center mb-2"></div>
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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Head to head */}
        {topH2H.length > 0 && (
          <div>
            <SectionHeader>Head-to-Head</SectionHeader>
            <div className="rounded-lg border border-border/40 overflow-hidden">
              {topH2H.map(([oppId, record], i) => (
                <Link
                  key={oppId}
                  href={`/tag-teams/${oppId}`}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/10 transition-colors ${i > 0 ? "border-t border-border/20" : ""}`}
                >
                  <span className="font-medium truncate">{teamNames[oppId] ?? "?"}</span>
                  <span className="tabular-nums shrink-0">
                    <span className={record.wins > 0 ? "text-emerald-400" : "text-muted-foreground/40"}>{record.wins}</span>
                    <span className="text-muted-foreground/40 mx-1">-</span>
                    <span className={record.losses > 0 ? "text-red-400" : "text-muted-foreground/40"}>{record.losses}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tier history + upcoming */}
        <div className="space-y-6">
          {tierHistory.length > 0 && (
            <div>
              <SectionHeader>Tier History</SectionHeader>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                {tierHistory.map((a, i) => (
                  <div key={a.id} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? "border-t border-border/20" : ""}`}>
                    <span className="text-muted-foreground">Season {a.seasons?.season_number ?? "?"}</span>
                    <span className="font-medium">{a.tiers?.short_name || a.tiers?.name || "?"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <SectionHeader>Upcoming Matches</SectionHeader>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                {upcoming.slice(0, 5).map((m, i) => {
                  const oppId = opponentOf(m);
                  return (
                    <div key={m.id} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? "border-t border-border/20" : ""}`}>
                      <span>
                        <span className="text-muted-foreground/60">vs </span>
                        <Link href={`/tag-teams/${oppId}`} className="font-medium hover:text-gold transition-colors">
                          {teamNames[oppId] ?? "?"}
                        </Link>
                      </span>
                      <span className="text-xs text-muted-foreground/60">{m.tiers?.short_name || m.tiers?.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Match history */}
      {played.length > 0 && (
        <div className="mt-8">
          <SectionHeader>Match History</SectionHeader>
          <div className="rounded-lg border border-border/40 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 border-b border-border/20">
                  <th className="px-3 py-2 text-left w-14">Result</th>
                  <th className="px-3 py-2 text-left">Opponent</th>
                  <th className="px-3 py-2 text-left hidden sm:table-cell">Tier</th>
                  <th className="px-3 py-2 text-left hidden sm:table-cell">Phase</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">Stipulation</th>
                  <th className="px-3 py-2 text-right w-16">Time</th>
                </tr>
              </thead>
              <tbody>
                {played.map((m) => {
                  const won = m.winner_tag_team_id === id;
                  const oppId = opponentOf(m);
                  return (
                    <tr key={m.id} className="border-t border-border/10">
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${won ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                          {won ? "WIN" : "LOSS"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/tag-teams/${oppId}`} className="font-medium hover:text-gold transition-colors">
                          {teamNames[oppId] ?? "?"}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        {m.tiers?.short_name || m.tiers?.name} <span className="text-muted-foreground/40">· S{m.seasons?.season_number}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{phaseLabel(m.match_phase)}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{m.stipulation ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {m.match_time_seconds ? formatTime(m.match_time_seconds) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
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
