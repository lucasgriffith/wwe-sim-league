import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAllAssignments,
  getAllMatches,
  getChampions,
  getCurrentSeason,
  getTagTeams,
} from "@/lib/data/cached";
import { computeElo } from "@/lib/elo/compute-elo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

  const [teams, allMatchRows, allAssignRows, currentSeason, champions] =
    await Promise.all([
      getTagTeams(),
      getAllMatches(),
      getAllAssignments(),
      getCurrentSeason(),
      getChampions(),
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
  const eloRatings = computeElo(allMatchRows);
  const eloEntry = eloRatings.get(id) ?? null;
  const eloRank = eloEntry
    ? 1 +
      teams.filter((t) => {
        const g = (t.wrestler_a as unknown as Member | null)?.gender ?? "male";
        return (
          t.id !== id &&
          g === teamGender &&
          (eloRatings.get(t.id)?.rating ?? -Infinity) > eloEntry.rating
        );
      }).length
    : null;

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
      <div className="mt-6 mb-8 flex items-center gap-5">
        <div className="flex items-center -space-x-5 shrink-0">
          {[memberA, memberB].map((m, i) =>
            m?.image_url ? (
              <SmartImage
                key={i}
                src={m.image_url}
                alt={m.name}
                width={160}
                height={160}
                className={`h-20 w-20 rounded-xl object-cover border-2 border-background shadow-lg ${i === 0 ? "relative z-10" : ""}`}
              />
            ) : (
              <div
                key={i}
                className={`h-20 w-20 rounded-xl bg-muted/20 border-2 border-background flex items-center justify-center ${i === 0 ? "relative z-10" : ""}`}
              >
                <span className="text-xl font-bold text-muted-foreground/20">
                  {m?.name.charAt(0) ?? "?"}
                </span>
              </div>
            )
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight truncate">{team.name}</h1>
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
              🏆 Reigning {reigning.beltName} Champions
            </p>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 stagger-children">
        <StatCard label="Career Record">
          <p className="text-3xl font-bold tabular-nums">
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
        <div className="mt-3 rounded-xl border border-border/40 bg-gradient-to-br from-gold/5 to-transparent p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Elo Rating</p>
              <p className="text-3xl font-bold tabular-nums text-gold">{Math.round(eloEntry.rating)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                peak {Math.round(eloEntry.peak)}
                {eloRank != null && <> · #{eloRank} {teamGender === "female" ? "women's" : "men's"} tag division</>}
              </p>
            </div>
            <div className="flex-1 min-w-0 text-muted-foreground">
              <RatingSparkline
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
      <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 stagger-children">
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
                  <div className="text-2xl text-center mb-2">🏆</div>
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
  return (
    <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
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
    <Card className={`border-border/40 ${highlight ? "bg-gradient-to-br from-gold/5 to-transparent" : ""}`}>
      <CardContent className="py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
        {children ?? <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}
