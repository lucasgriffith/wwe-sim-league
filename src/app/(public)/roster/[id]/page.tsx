import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { getCurrentChampions } from "@/lib/champions";

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

export default async function WrestlerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const supabase = await createClient();

  // Resolve slug to UUID if needed
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
  let id = rawId;
  if (!isUuid) {
    const { data: found } = await supabase
      .from("wrestlers")
      .select("id")
      .eq("slug", rawId)
      .single();
    if (!found) notFound();
    id = found.id;
  }

  // Fetch everything in parallel
  const [
    { data: wrestler },
    { data: assignments },
    { data: matchesAsA },
    { data: matchesAsB },
    { data: tiers },
    { data: wrestlers },
    { data: tagTeamMemberships },
  ] = await Promise.all([
    supabase.from("wrestlers").select("*").eq("id", id).single(),
    supabase
      .from("tier_assignments")
      .select("*, tiers(id, name, short_name, tier_number), seasons(season_number, status)")
      .eq("wrestler_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("matches")
      .select("*, tiers(name, short_name, tier_number, belt_image_url), seasons(season_number)")
      .eq("wrestler_a_id", id)
      .order("played_at", { ascending: false }),
    supabase
      .from("matches")
      .select("*, tiers(name, short_name, tier_number, belt_image_url), seasons(season_number)")
      .eq("wrestler_b_id", id)
      .order("played_at", { ascending: false }),
    supabase
      .from("tiers")
      .select("id, name, short_name, tier_number, belt_image_url")
      .order("tier_number"),
    supabase.from("wrestlers").select("id, name, slug").order("name"),
    supabase
      .from("tag_teams")
      .select("id, name, wrestler_a_id, wrestler_b_id, is_active")
      .or(`wrestler_a_id.eq.${id},wrestler_b_id.eq.${id}`),
  ]);

  if (!wrestler) notFound();

  const wrestlerMap = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.name])
  );
  const wrestlerSlugMap = Object.fromEntries(
    (wrestlers ?? []).filter((w) => w.slug).map((w) => [w.id, w.slug])
  );

  // Combine and sort all matches
  const allMatches = [...(matchesAsA ?? []), ...(matchesAsB ?? [])]
    .filter((m) => m.played_at)
    .sort((a, b) => {
      // Sort by season desc, then by played_at desc
      const sA = (a.seasons as { season_number: number } | null)?.season_number ?? 0;
      const sB = (b.seasons as { season_number: number } | null)?.season_number ?? 0;
      if (sB !== sA) return sB - sA;
      return new Date(b.played_at!).getTime() - new Date(a.played_at!).getTime();
    });

  // ── Stats ────────────────────────────────────────────────────────────
  const wins = allMatches.filter((m) => m.winner_wrestler_id === id).length;
  const losses = allMatches.length - wins;
  const winPct = allMatches.length > 0 ? ((wins / allMatches.length) * 100).toFixed(1) : null;

  // Get current champions
  const currentChampions = await getCurrentChampions(supabase);
  const isCurrentChampion = !!currentChampions[id];

  // Championships (finals won)
  const titlesWon = allMatches
    .filter((m) => m.match_phase === "final" && m.winner_wrestler_id === id)
    .map((m) => {
      const tier = m.tiers as { name: string; short_name: string | null; tier_number: number; belt_image_url: string | null } | null;
      const season = m.seasons as { season_number: number } | null;
      return {
        tierName: tier?.short_name || tier?.name || "Unknown",
        tierNumber: tier?.tier_number ?? 99,
        season: season?.season_number ?? 0,
        beltImageUrl: tier?.belt_image_url ?? null,
        tierId: m.tier_id as string,
      };
    });

  // Finals appearances
  const finalsAppearances = allMatches.filter((m) => m.match_phase === "final").length;

  // Playoff record
  const playoffMatches = allMatches.filter((m) =>
    ["quarterfinal", "semifinal", "final"].includes(m.match_phase)
  );
  const playoffWins = playoffMatches.filter((m) => m.winner_wrestler_id === id).length;
  const playoffLosses = playoffMatches.length - playoffWins;

  // Relegation record
  const relegationMatches = allMatches.filter((m) => m.match_phase === "relegation");
  const relegationWins = relegationMatches.filter((m) => m.winner_wrestler_id === id).length;
  const relegationLosses = relegationMatches.length - relegationWins;

  // Match times
  const matchTimes = allMatches
    .filter((m) => m.match_time_seconds)
    .map((m) => m.match_time_seconds!);
  const avgMatchTime =
    matchTimes.length > 0
      ? Math.round(matchTimes.reduce((a, b) => a + b, 0) / matchTimes.length)
      : null;
  const fastestWin = (() => {
    const winTimes = allMatches
      .filter((m) => m.winner_wrestler_id === id && m.match_time_seconds)
      .map((m) => m.match_time_seconds!);
    return winTimes.length > 0 ? Math.min(...winTimes) : null;
  })();
  const longestMatch = matchTimes.length > 0 ? Math.max(...matchTimes) : null;

  // Current win/loss streak
  let currentStreak = 0;
  let streakType: "W" | "L" | null = null;
  for (const m of allMatches) {
    const won = m.winner_wrestler_id === id;
    if (streakType === null) {
      streakType = won ? "W" : "L";
      currentStreak = 1;
    } else if ((won && streakType === "W") || (!won && streakType === "L")) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Best win streak ever
  let bestStreak = 0;
  let tempStreak = 0;
  for (const m of [...allMatches].reverse()) {
    if (m.winner_wrestler_id === id) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // Highest tier
  const tierNumbers = (assignments ?? [])
    .map((a) => (a.tiers as { tier_number: number } | null)?.tier_number)
    .filter((n): n is number => n !== undefined && n !== null);
  const highestTier = tierNumbers.length > 0 ? Math.min(...tierNumbers) : null;

  // Unique opponents faced
  const opponentIds = new Set<string>();
  for (const m of allMatches) {
    const oppId = m.wrestler_a_id === id ? m.wrestler_b_id : m.wrestler_a_id;
    if (oppId) opponentIds.add(oppId);
  }

  // Most faced opponent
  const opponentCounts: Record<string, number> = {};
  for (const m of allMatches) {
    const oppId = m.wrestler_a_id === id ? m.wrestler_b_id : m.wrestler_a_id;
    if (oppId) opponentCounts[oppId] = (opponentCounts[oppId] ?? 0) + 1;
  }
  const mostFacedId = Object.entries(opponentCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const nemesis = mostFacedId
    ? { name: wrestlerMap[mostFacedId[0]] ?? "Unknown", count: mostFacedId[1] }
    : null;

  // Tag teams
  const tagTeams = tagTeamMemberships ?? [];

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <Link
        href="/roster"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Roster
      </Link>

      {/* Header */}
      <div className="mt-6 mb-8 flex items-start gap-5">
        {wrestler.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={wrestler.image_url}
            alt={wrestler.name}
            className="h-20 w-20 rounded-xl object-cover border-2 border-border/30 shrink-0 shadow-lg"
          />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-muted/20 border-2 border-border/20 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-muted-foreground/30">
              {wrestler.name.charAt(0)}
            </span>
          </div>
        )}
        <div>
        <h1 className="text-3xl font-bold tracking-tight">{wrestler.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs ${wrestler.gender === "male" ? "border-blue-500/30 text-blue-400" : "border-purple-500/30 text-purple-400"}`}
          >
            {wrestler.gender === "male" ? "Male" : "Female"}
          </Badge>
          {wrestler.brand && (
            <Badge variant="secondary" className="text-xs">{wrestler.brand}</Badge>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`status-dot ${wrestler.is_active ? "status-dot-active" : "status-dot-inactive"}`} />
            <span className="text-xs text-muted-foreground">
              {wrestler.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          {tagTeams.length > 0 && (
            <span className="text-xs text-muted-foreground">
              · Tag: {tagTeams.map((t) => t.name).join(", ")}
            </span>
          )}
        </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 stagger-children">
        <StatCard
          label="Overall"
          value={wrestler.overall_rating?.toString() ?? "—"}
          gradient="from-amber-500/5"
        />
        <StatCard label="Career Record" gradient="from-blue-500/5">
          <p className="text-3xl font-bold tabular-nums">
            <span className="text-emerald-400">{wins}</span>
            <span className="text-muted-foreground/40 mx-1">-</span>
            <span className="text-red-400">{losses}</span>
          </p>
          {winPct && (
            <p className="mt-0.5 text-xs text-muted-foreground">{winPct}% win rate</p>
          )}
        </StatCard>
        <StatCard
          label="Championships"
          value={titlesWon.length.toString()}
          gradient="from-gold/5"
          highlight={titlesWon.length > 0}
        />
        <StatCard
          label="Seasons Played"
          value={(assignments?.length ?? 0).toString()}
          gradient="from-purple-500/5"
        />
      </div>

      {/* Titles Won */}
      {titlesWon.length > 0 && (
        <div className="mt-6">
          <SectionHeader>Championships Won</SectionHeader>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {titlesWon.map((t, i) => {
              const isCurrent = currentChampions[id]?.beltName === t.tierName;
              return (
                <div
                  key={i}
                  className={`relative flex-shrink-0 rounded-lg border p-3 min-w-[140px] max-w-[180px] ${
                    isCurrent
                      ? "border-gold/40 bg-gold/[0.06] shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                      : "border-gold/20 bg-gold/[0.03]"
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gold">Current</span>
                    </div>
                  )}
                  {t.beltImageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={t.beltImageUrl}
                      alt={`${t.tierName} belt`}
                      className="h-12 w-auto object-contain mx-auto mb-2"
                    />
                  ) : (
                    <div className="text-2xl text-center mb-2">🏆</div>
                  )}
                  <p className="text-sm font-bold text-gold text-center truncate">{t.tierName}</p>
                  <p className="text-[10px] text-gold/60 text-center mt-0.5">Season {t.season}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fun Stats Grid */}
      <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <MiniStat label="Playoff Record" value={playoffMatches.length > 0 ? `${playoffWins}-${playoffLosses}` : "—"} />
        <MiniStat label="Finals Appearances" value={finalsAppearances > 0 ? finalsAppearances.toString() : "—"} />
        <MiniStat label="Relegation Record" value={relegationMatches.length > 0 ? `${relegationWins}-${relegationLosses}` : "—"} />
        <MiniStat label="Highest Tier" value={highestTier ? `T${highestTier}` : "—"} />
        <MiniStat
          label="Current Streak"
          value={currentStreak > 0 && streakType ? `${currentStreak}${streakType}` : "—"}
          highlight={streakType === "W" && currentStreak >= 3}
        />
        <MiniStat label="Best Win Streak" value={bestStreak > 0 ? bestStreak.toString() : "—"} />
        <MiniStat label="Fastest Win" value={fastestWin ? formatTime(fastestWin) : "—"} />
        <MiniStat label="Avg Match Time" value={avgMatchTime ? formatTime(avgMatchTime) : "—"} />
        <MiniStat label="Longest Match" value={longestMatch ? formatTime(longestMatch) : "—"} />
        <MiniStat label="Unique Opponents" value={opponentIds.size > 0 ? opponentIds.size.toString() : "—"} />
        <MiniStat label="Pool Play Record" value={(() => {
          const pp = allMatches.filter(m => m.match_phase === "pool_play");
          if (pp.length === 0) return "—";
          const w = pp.filter(m => m.winner_wrestler_id === id).length;
          return `${w}-${pp.length - w}`;
        })()} />
        <MiniStat label="Total Matches" value={allMatches.length > 0 ? allMatches.length.toString() : "—"} />
      </div>

      {/* Head-to-Head Records */}
      {Object.keys(opponentCounts).length > 0 && (
        <div className="mt-6">
          <SectionHeader>Head-to-Head Records</SectionHeader>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(opponentCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([oppId, count]) => {
                const oppName = wrestlerMap[oppId] ?? "Unknown";
                const winsVs = allMatches.filter(
                  (m) =>
                    (m.wrestler_a_id === oppId || m.wrestler_b_id === oppId) &&
                    m.winner_wrestler_id === id
                ).length;
                const lossesVs = count - winsVs;
                return (
                  <Link
                    key={oppId}
                    href={`/roster/${wrestlerSlugMap[oppId] ?? oppId}`}
                    className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/30 px-3 py-2.5 hover:border-border/50 transition-colors"
                  >
                    <span className="text-sm font-medium flex-1 truncate">
                      {oppName}
                    </span>
                    <span className="tabular-nums text-xs font-bold">
                      <span className="text-emerald-400">{winsVs}</span>
                      <span className="text-muted-foreground/30 mx-0.5">-</span>
                      <span className="text-red-400">{lossesVs}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground/40">
                      ({count}x)
                    </span>
                  </Link>
                );
              })}
          </div>
        </div>
      )}

      {/* Tier History */}
      {assignments && assignments.length > 0 && (
        <div className="mt-8">
          <SectionHeader>Tier History</SectionHeader>
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Season</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Pool</th>
                  <th className="px-4 py-3">Seed</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const tier = a.tiers as { name: string; short_name: string | null; tier_number: number } | null;
                  const season = a.seasons as { season_number: number; status: string } | null;
                  return (
                    <tr key={a.id} className="border-b border-border/20 table-row-hover">
                      <td className="px-4 py-3 text-sm tabular-nums">
                        Season {season?.season_number}
                        {season?.status !== "completed" && (
                          <Badge variant="outline" className="ml-2 text-[9px]">
                            {season?.status}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-muted-foreground font-mono text-xs mr-1.5">
                          T{tier?.tier_number}
                        </span>
                        <span className="font-medium">
                          {tier?.short_name || tier?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{a.pool || "—"}</td>
                      <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">{a.seed ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full Match History */}
      {allMatches.length > 0 && (
        <div className="mt-8">
          <SectionHeader>Match History ({allMatches.length})</SectionHeader>
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Opponent</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Tier</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Phase</th>
                  <th className="px-4 py-3 hidden md:table-cell">Stipulation</th>
                  <th className="px-4 py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {allMatches.map((m) => {
                  const won = m.winner_wrestler_id === id;
                  const oppId =
                    m.wrestler_a_id === id
                      ? m.wrestler_b_id
                      : m.wrestler_a_id;
                  const oppName = oppId ? wrestlerMap[oppId] ?? "Unknown" : "Unknown";
                  const tier = m.tiers as { name: string; short_name: string | null; tier_number: number } | null;
                  const season = m.seasons as { season_number: number } | null;

                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-border/20 table-row-hover ${won ? "" : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            won
                              ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                              : "border-red-500/30 text-red-400 bg-red-500/5"
                          }`}
                        >
                          {won ? "W" : "L"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        {oppId ? (
                          <Link
                            href={`/roster/${wrestlerSlugMap[oppId] ?? oppId}`}
                            className="hover:text-gold transition-colors"
                          >
                            {oppName}
                          </Link>
                        ) : (
                          oppName
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                        <span className="font-mono mr-1">T{tier?.tier_number}</span>
                        {tier?.short_name || tier?.name}
                        <span className="text-muted-foreground/40 ml-1">S{season?.season_number}</span>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            m.match_phase === "final"
                              ? "bg-gold/10 text-gold border-gold/20"
                              : m.match_phase === "relegation"
                                ? "bg-red-500/10 text-red-400"
                                : ""
                          }`}
                        >
                          {phaseLabel(m.match_phase)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                        {m.stipulation || "Standard"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                        {m.match_time_seconds
                          ? formatTime(m.match_time_seconds)
                          : "—"}
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

/* ─── Sub-components ─────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  gradient,
  highlight,
  children,
}: {
  label: string;
  value?: string;
  gradient: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card className={`card-hover bg-gradient-to-br ${gradient} to-transparent border-border/40`}>
      <CardHeader className="pb-1">
        <CardTitle className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children ?? (
          <p className={`text-3xl font-bold tabular-nums ${highlight ? "text-gold" : ""}`}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-card/30 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          highlight ? "text-emerald-400" : value === "—" ? "text-muted-foreground/30" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}
