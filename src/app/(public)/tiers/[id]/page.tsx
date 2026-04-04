export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { BeltImageEditor } from "@/components/tiers/belt-image-editor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { BracketView } from "@/components/playoffs/bracket-view";
import { TierSchedule } from "@/components/tiers/tier-schedule";
import { computeClinchStatus, type ClinchStatus } from "@/lib/standings/clinch";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function TierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Try slug first, fall back to UUID for backwards compatibility
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: tier } = await supabase
    .from("tiers")
    .select("*, divisions(name, gender, division_type)")
    .eq(isUuid ? "id" : "slug", id)
    .single();

  if (!tier) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("*")
    .neq("status", "completed")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let assignments: any[] = [];

  if (activeSeason) {
    const { data } = await supabase
      .from("tier_assignments")
      .select(
        "id, pool, seed, wrestler_id, tag_team_id, wrestlers(id, name), tag_teams(id, name)"
      )
      .eq("season_id", activeSeason.id)
      .eq("tier_id", tier.id)
      .order("pool")
      .order("seed");
    assignments = data ?? [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matches: any[] = [];

  if (activeSeason) {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .eq("season_id", activeSeason.id)
      .eq("tier_id", tier.id)
      .order("round_number")
      .order("pool");
    matches = data ?? [];
  }

  // Get all wrestler/tag names for match display
  const allIds = new Set<string>();
  matches.forEach((m) => {
    if (m.wrestler_a_id) allIds.add(m.wrestler_a_id);
    if (m.wrestler_b_id) allIds.add(m.wrestler_b_id);
    if (m.tag_team_a_id) allIds.add(m.tag_team_a_id);
    if (m.tag_team_b_id) allIds.add(m.tag_team_b_id);
  });
  assignments.forEach((a) => {
    if (a.wrestler_id) allIds.add(a.wrestler_id);
    if (a.tag_team_id) allIds.add(a.tag_team_id);
  });

  const nameMap: Record<string, string> = {};
  assignments.forEach((a) => {
    const pid = a.wrestler_id || a.tag_team_id;
    const name = a.wrestlers?.name || a.tag_teams?.name || "Unknown";
    if (pid) nameMap[pid] = name;
  });

  const division = tier.divisions as {
    name: string;
    gender: string;
    division_type: string;
  };

  const pools = tier.has_pools ? ["A", "B"] : [null];
  const standingsByPool = pools.map((pool) => {
    const poolAssignments = assignments.filter((a) =>
      pool ? a.pool === pool : true
    );
    const poolMatches = matches.filter(
      (m) =>
        m.match_phase === "pool_play" && (pool ? m.pool === pool : true)
    );

    const stats = poolAssignments.map((a) => {
      const participantId = a.wrestler_id || a.tag_team_id;
      const name = a.wrestlers?.name || a.tag_teams?.name || "Unknown";
      const isTag = !!a.tag_team_id;

      const played = poolMatches.filter(
        (m) =>
          (isTag
            ? m.tag_team_a_id === participantId ||
              m.tag_team_b_id === participantId
            : m.wrestler_a_id === participantId ||
              m.wrestler_b_id === participantId)
      );
      const completedMatches = played.filter((m) => m.played_at);
      const wins = completedMatches.filter(
        (m) =>
          (isTag
            ? m.winner_tag_team_id === participantId
            : m.winner_wrestler_id === participantId)
      ).length;
      const losses = completedMatches.length - wins;
      const totalTime = completedMatches.reduce(
        (sum, m) => sum + (m.match_time_seconds ?? 0),
        0
      );

      const avgTime = completedMatches.length > 0
        ? Math.round(totalTime / completedMatches.length)
        : 0;

      return {
        id: participantId!,
        name,
        wins,
        losses,
        winPct:
          completedMatches.length > 0 ? wins / completedMatches.length : 0,
        totalTime,
        avgTime,
        matchesPlayed: completedMatches.length,
      };
    });

    // Sort: wins desc, then tiebreak by avg time
    // >50% win rate: shorter avg time = better (dominant wins)
    // <50% win rate: longer avg time = better (put up a fight)
    stats.sort((a, b) => {
      // Primary: win percentage
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      // Secondary: wins
      if (b.wins !== a.wins) return b.wins - a.wins;
      // Tertiary: avg time tiebreak
      if (a.avgTime && b.avgTime) {
        const aAbove500 = a.winPct >= 0.5;
        const bAbove500 = b.winPct >= 0.5;
        if (aAbove500 && bAbove500) return a.avgTime - b.avgTime; // shorter = better
        if (!aAbove500 && !bAbove500) return b.avgTime - a.avgTime; // longer = better
      }
      return 0;
    });

    // Compute clinch status
    const matchesPerParticipant = stats.length > 1 ? stats.length - 1 : 0;
    const clinchMap = computeClinchStatus(
      stats.map((s) => ({
        participantId: s.id,
        wins: s.wins,
        losses: s.losses,
        winPct: s.winPct,
      })),
      matchesPerParticipant,
      poolMatches.filter((m) => m.played_at).length
    );

    return { pool, stats, clinchMap };
  });

  const poolPlayMatches = matches.filter(
    (m) => m.match_phase === "pool_play"
  );
  const totalMatches = poolPlayMatches.length;
  const playedMatches = poolPlayMatches.filter((m) => m.played_at).length;
  const progressPct =
    totalMatches > 0 ? (playedMatches / totalMatches) * 100 : 0;

  // Playoff matches
  const playoffMatches = matches.filter((m) =>
    ["quarterfinal", "semifinal", "final"].includes(m.match_phase)
  );

  // Group schedule by round for display
  const scheduleByRound = (pool: string | null) => {
    const poolMatches = poolPlayMatches.filter((m) =>
      pool ? m.pool === pool : true
    );
    const rounds = new Map<number, typeof poolMatches>();
    poolMatches.forEach((m) => {
      const round = m.round_number ?? 0;
      if (!rounds.has(round)) rounds.set(round, []);
      rounds.get(round)!.push(m);
    });
    return Array.from(rounds.entries()).sort(([a], [b]) => a - b);
  };

  const getName = (id: string | null) => {
    if (!id) return "TBD";
    return nameMap[id] ?? "Unknown";
  };

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      {/* Hero */}
      <div
        className="mb-8 rounded-xl border border-border/40 bg-gradient-to-r p-6"
        style={{
          backgroundImage: `linear-gradient(135deg, ${tier.color}08 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/tiers"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mr-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Tiers
          </Link>
          <span className="text-border/30">·</span>
          <Badge
            variant="outline"
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{
              color: tier.color ?? undefined,
              borderColor: tier.color ? `${tier.color}40` : undefined,
            }}
          >
            Tier {tier.tier_number}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {division.name}
          </Badge>
        </div>
        <div className="flex items-start gap-4">
          {tier.belt_image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tier.belt_image_url}
              alt={`${tier.name} belt`}
              className="h-16 w-auto object-contain shrink-0 opacity-80"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{tier.name}</h1>
            {tier.fixed_stipulation && (
              <p className="mt-2 text-sm text-muted-foreground">
                All matches:{" "}
                <span className="text-wwe-red font-medium">
                  {tier.fixed_stipulation}
                </span>
              </p>
            )}
            {!!user && (
              <BeltImageEditor tierId={tier.id} currentUrl={tier.belt_image_url} />
            )}
          </div>
        </div>
      </div>

      {activeSeason ? (
        <div className="space-y-8">
          {/* Season + Progress */}
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-xs">
              Season {activeSeason.season_number}
            </Badge>
            <Badge variant="secondary" className="text-[10px] capitalize">
              {activeSeason.status.replace("_", " ")}
            </Badge>
            <div className="flex items-center gap-2 flex-1">
              <div className="h-1.5 flex-1 max-w-48 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gold transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {playedMatches}/{totalMatches} pool matches
              </span>
            </div>
          </div>

          {/* Standings + Schedule side by side per pool */}
          {standingsByPool.map(({ pool, stats, clinchMap }) => {
            const schedule = scheduleByRound(pool);

            return (
              <div key={pool ?? "all"}>
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  {pool ? (
                    <>
                      Pool {pool}
                      <span className="text-xs font-normal text-muted-foreground">
                        {stats.length} participants
                      </span>
                    </>
                  ) : (
                    "Standings"
                  )}
                </h2>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Standings Table */}
                  <div className="rounded-lg border border-border/40 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="w-10 text-[11px] uppercase tracking-wider">
                            #
                          </TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">
                            Name
                          </TableHead>
                          <TableHead className="text-center text-[11px] uppercase tracking-wider">
                            W
                          </TableHead>
                          <TableHead className="text-center text-[11px] uppercase tracking-wider">
                            L
                          </TableHead>
                          <TableHead className="text-center text-[11px] uppercase tracking-wider">
                            Win%
                          </TableHead>
                          <TableHead className="text-center text-[11px] uppercase tracking-wider">
                            Avg Time
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.map((s, i) => (
                          <TableRow
                            key={s.id}
                            className="table-row-hover border-border/30"
                          >
                            <TableCell
                              className={`tabular-nums font-semibold ${
                                i < 2
                                  ? "text-gold"
                                  : i === 2
                                    ? "text-muted-foreground"
                                    : "text-muted-foreground/50"
                              }`}
                            >
                              {i + 1}
                              {i < 2 && (
                                <span className="ml-0.5 text-[8px]">★</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              <span className="flex items-center gap-1.5">
                                {s.name}
                                {clinchMap.get(s.id) === "clinched" && (
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-1 rounded" title="Clinched playoff spot">
                                    ✓
                                  </span>
                                )}
                                {clinchMap.get(s.id) === "eliminated" && (
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-red-400/60 bg-red-400/10 px-1 rounded" title="Eliminated from playoffs">
                                    ✗
                                  </span>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              {s.wins}
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              {s.losses}
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              {s.matchesPlayed > 0
                                ? (s.winPct * 100).toFixed(0) + "%"
                                : "-"}
                            </TableCell>
                            <TableCell className="text-center tabular-nums text-muted-foreground">
                              {s.avgTime > 0 ? formatTime(s.avgTime) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {stats.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center text-muted-foreground py-8"
                            >
                              No participants assigned yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Schedule Grid with inline match entry */}
                  {schedule.length > 0 && (
                    <TierSchedule
                      isAdmin={!!user}
                      rounds={schedule.map(([round, roundMatches]) => ({
                        round,
                        matches: roundMatches.map((m) => {
                          const aId = m.wrestler_a_id || m.tag_team_a_id;
                          const bId = m.wrestler_b_id || m.tag_team_b_id;
                          const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
                          return {
                            id: m.id,
                            aId: aId ?? "",
                            bId: bId ?? "",
                            aName: getName(aId),
                            bName: getName(bId),
                            winnerId,
                            isPlayed: !!m.played_at,
                            matchTime: m.match_time_seconds,
                            isTag: !!m.tag_team_a_id,
                          };
                        }),
                      }))}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Playoff Bracket (if any playoff matches exist) */}
          {playoffMatches.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <span className="text-gold">🏆</span> Playoffs
              </h2>
              <div className="rounded-lg border border-gold/20 bg-gold/[0.02] p-4 overflow-x-auto">
                <BracketView
                  tierName={tier.short_name || tier.name}
                  isTagFinal={!tier.has_pools}
                  matches={playoffMatches.map((m) => {
                    const aId = m.wrestler_a_id || m.tag_team_a_id;
                    const bId = m.wrestler_b_id || m.tag_team_b_id;
                    const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
                    const qfMatches = playoffMatches.filter((pm) => pm.match_phase === "quarterfinal");
                    const sfMatches = playoffMatches.filter((pm) => pm.match_phase === "semifinal");
                    const idx = m.match_phase === "quarterfinal"
                      ? qfMatches.indexOf(m)
                      : m.match_phase === "semifinal"
                        ? sfMatches.indexOf(m)
                        : 0;
                    const matchKey = m.match_phase === "quarterfinal"
                      ? `QF${idx + 1}`
                      : m.match_phase === "semifinal"
                        ? `SF${idx + 1}`
                        : "Final";
                    return {
                      id: m.id,
                      matchKey,
                      round: m.match_phase,
                      participantA: aId ? { id: aId, name: getName(aId), seed: 0 } : null,
                      participantB: bId ? { id: bId, name: getName(bId), seed: 0 } : null,
                      winnerId,
                      stipulation: m.stipulation,
                      matchTime: m.match_time_seconds,
                      isPlayed: !!m.played_at,
                      isBye: false,
                    };
                  })}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/40 bg-card/30 px-6 py-12 text-center">
          <h3 className="text-base font-semibold">No Active Season</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new season to start assigning wrestlers to this tier.
          </p>
        </div>
      )}
    </div>
  );
}
