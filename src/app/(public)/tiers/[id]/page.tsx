export const dynamic = "force-dynamic";

import React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { BeltImageEditor } from "@/components/tiers/belt-image-editor";
import { getCurrentChampions } from "@/lib/champions";
import { ChampionBadge } from "@/components/ui/champion-badge";
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
import { Sparkline } from "@/components/ui/sparkline";

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
        "id, pool, seed, wrestler_id, tag_team_id, wrestlers(id, name, slug), tag_teams(id, name)"
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

  // Get current champions
  const champions = await getCurrentChampions(supabase);

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

  // Build slug map for wrestler links
  const wrestlerSlugMap: Record<string, string> = {};
  assignments.forEach((a) => {
    if (a.wrestler_id && a.wrestlers?.slug) {
      wrestlerSlugMap[a.wrestler_id] = a.wrestlers.slug;
    }
  });

  const division = tier.divisions as {
    name: string;
    gender: string;
    division_type: string;
  };
  const isTagDivision = division.division_type === "tag";

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

      // Compute streak
      const sortedByDate = [...completedMatches]
        .filter((m) => m.played_at)
        .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
      let streak = 0;
      if (sortedByDate.length > 0) {
        const winnerId = isTag ? sortedByDate[0].winner_tag_team_id : sortedByDate[0].winner_wrestler_id;
        const isFirstWin = winnerId === participantId;
        for (const m of sortedByDate) {
          const mWinner = isTag ? m.winner_tag_team_id : m.winner_wrestler_id;
          if (isFirstWin && mWinner === participantId) streak++;
          else if (!isFirstWin && mWinner !== participantId) streak--;
          else break;
        }
      }

      // Compute trend (last 10 match results, chronological order)
      const trend = sortedByDate
        .slice(0, 10)
        .reverse()
        .map((m) => {
          const mWinner = isTag ? m.winner_tag_team_id : m.winner_wrestler_id;
          return mWinner === participantId;
        });

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
        gb: "", // computed before sort
        gbNum: 0,
        streak,
        streakLabel: streak > 0 ? `W${streak}` : streak < 0 ? `L${Math.abs(streak)}` : "—",
        trend,
        linkHref: isTag ? "/tag-teams" : `/roster/${wrestlerSlugMap[participantId!] ?? participantId}`,
      };
    });

    // Compute GB values (relative to best record)
    // First find the leader by raw wins desc, losses asc
    const preSorted = [...stats].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    });
    if (preSorted.length > 0) {
      const leader = preSorted[0];
      stats.forEach((s) => {
        const gb = ((leader.wins - s.wins) + (s.losses - leader.losses)) / 2;
        s.gbNum = gb;
        s.gb = gb === 0 ? "—" : gb.toFixed(1);
      });
    }

    // Sort: GB asc → avg time tiebreak
    stats.sort((a, b) => {
      // Primary: GB (lower = better)
      const gbA = a.gbNum ?? 999;
      const gbB = b.gbNum ?? 999;
      if (gbA !== gbB) return gbA - gbB;
      // Secondary: win% (for teams with same GB but different games played)
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      // Tertiary: avg time tiebreak
      if (a.avgTime && b.avgTime) {
        const aAbove500 = a.winPct >= 0.5;
        const bAbove500 = b.winPct >= 0.5;
        if (aAbove500 && bAbove500) return a.avgTime - b.avgTime;
        if (!aAbove500 && !bAbove500) return b.avgTime - a.avgTime;
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
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold sm:text-3xl">{tier.name}</h1>
            {tier.belt_image_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tier.belt_image_url}
                alt={`${tier.name} belt`}
                className="h-48 sm:h-60 w-auto object-contain shrink-0 -my-16 sm:-my-20"
              />
            )}
          </div>
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
                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 bg-muted/5 border-b border-border/20">
                      <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/40">Legend</span>
                      <span className="text-[9px] text-emerald-400">● Playoff (Top 2)</span>
                      <span className="text-[9px] text-blue-400">● Wild Card (3rd)</span>
                      <span className="text-[9px] text-foreground/30">● Safe</span>
                      <span className="text-[9px] text-orange-400">● Relegation Playoff ⚔ (2nd from bottom)</span>
                      <span className="text-[9px] text-red-400">● Auto-Relegate ↓ (Last)</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="w-8 text-[10px] uppercase tracking-wider px-1 sm:px-4">#</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider px-1 sm:px-4">Name</TableHead>
                          <TableHead className="text-center text-[10px] uppercase tracking-wider w-8 px-1 sm:px-4">W</TableHead>
                          <TableHead className="text-center text-[10px] uppercase tracking-wider w-8 px-1 sm:px-4">L</TableHead>
                          <TableHead className="text-center text-[10px] uppercase tracking-wider w-12 px-1 sm:px-4">Win%</TableHead>
                          <TableHead className="text-center text-[10px] uppercase tracking-wider w-10 px-1 sm:px-4">GB</TableHead>
                          <TableHead className="text-center text-[10px] uppercase tracking-wider w-10 px-1 sm:px-4 hidden sm:table-cell">Strk</TableHead>
                          <TableHead className="text-center text-[10px] uppercase tracking-wider w-12 px-1 sm:px-4 hidden sm:table-cell">Trend</TableHead>
                          <TableHead className="text-center text-[10px] uppercase tracking-wider w-14 px-1 sm:px-4 hidden sm:table-cell">Avg Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.map((s, i) => {
                          const count = stats.length;

                          // Per-pool zone logic:
                          // Top 2 = Playoff, 3rd = Wild Card, 2nd from bottom = Relegation Playoff, Last = Auto-Relegate
                          // Everything in between = Safe
                          const isPlayoff = i < 2;
                          const isWildCard = i === 2 && count > 3;
                          const isAutoRelegate = i === count - 1 && count > 2;
                          const isRelegationPlayoff = i === count - 2 && count > 3 && !isPlayoff && !isWildCard;
                          const isSafe = !isPlayoff && !isWildCard && !isAutoRelegate && !isRelegationPlayoff;

                          let rankColor = "text-muted-foreground/50";
                          let leftBorder = "";
                          let zoneIcon = "";

                          if (isPlayoff) {
                            rankColor = "text-emerald-400";
                            leftBorder = "border-l-[3px] border-l-emerald-500/50";
                          } else if (isWildCard) {
                            rankColor = "text-blue-400";
                            leftBorder = "border-l-[3px] border-l-blue-500/40";
                          } else if (isAutoRelegate) {
                            rankColor = "text-red-400";
                            leftBorder = "border-l-[3px] border-l-red-500/50";
                            zoneIcon = "↓";
                          } else if (isRelegationPlayoff) {
                            rankColor = "text-orange-400";
                            leftBorder = "border-l-[3px] border-l-orange-500/40";
                            zoneIcon = "⚔";
                          } else if (isSafe) {
                            leftBorder = "border-l-[3px] border-l-foreground/10";
                          }

                          // Zone group borders
                          function getZone(idx: number) {
                            if (idx < 0 || idx >= count) return "none";
                            if (idx < 2) return "playoff";
                            if (idx === 2 && count > 3) return "wildcard";
                            if (idx === count - 1 && count > 2) return "autorel";
                            if (idx === count - 2 && count > 3 && idx >= 3) return "relplayoff";
                            return "safe";
                          }
                          const myZone = getZone(i);
                          const prevZone = getZone(i - 1);
                          const nextZone = getZone(i + 1);

                          // Zone border colors (RGB for inline styles)
                          const zoneRGB: Record<string, string> = {
                            playoff: "16,185,129",
                            wildcard: "59,130,246",
                            relplayoff: "249,115,22",
                            autorel: "239,68,68",
                          };
                          const rgb = zoneRGB[myZone] ?? "";
                          const isZoneStart = myZone !== "safe" && myZone !== "none" && prevZone !== myZone;
                          const isZoneEnd = myZone !== "safe" && myZone !== "none" && nextZone !== myZone;
                          const isInZone = myZone !== "safe" && myZone !== "none";

                          const zoneBorderStyle: React.CSSProperties = {
                            ...(isZoneStart ? { borderTop: `2px solid rgba(${rgb},0.25)` } : {}),
                            ...(isZoneEnd ? { borderBottom: `2px solid rgba(${rgb},0.25)` } : {}),
                          };
                          const zoneRightStyle: React.CSSProperties = isInZone
                            ? { borderRight: `2px solid rgba(${rgb},0.25)` }
                            : {};

                          // Zone background shading
                          const zoneBgStyle: React.CSSProperties = isInZone
                            ? { backgroundColor: `rgba(${rgb},0.04)` }
                            : {};

                          const streakColor = s.streakLabel.startsWith("W")
                            ? "text-emerald-400"
                            : s.streakLabel.startsWith("L")
                              ? "text-red-400"
                              : "text-muted-foreground/30";

                          // Remove inner border-b for rows within a zone (not the last row of that zone)
                          const suppressInnerBorder = isInZone && !isZoneEnd ? "border-b-0" : "";

                          return (
                            <React.Fragment key={s.id}>
                              <TableRow className={suppressInnerBorder} style={{ ...zoneBorderStyle, ...zoneBgStyle }}>
                                <TableCell className={`tabular-nums text-xs font-bold ${rankColor} ${leftBorder} px-1 sm:px-4`}>
                                  {i + 1}
                                </TableCell>
                                <TableCell className="px-1 sm:px-4">
                                  <span className="flex items-center gap-1.5 font-medium">
                                    {s.linkHref ? (
                                      <Link href={s.linkHref} className="hover:text-gold transition-colors">
                                        {s.name}
                                      </Link>
                                    ) : (
                                      <span>{s.name}</span>
                                    )}
                                    {champions[s.id] && (
                                      <ChampionBadge
                                        beltName={champions[s.id].beltName}
                                        beltImageUrl={champions[s.id].beltImageUrl}
                                      />
                                    )}
                                    {zoneIcon && (
                                      <span className={`text-[8px] font-bold ${rankColor}`}>{zoneIcon}</span>
                                    )}
                                    {clinchMap.get(s.id) === "clinched" && (
                                      <span className="text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1 rounded">✓</span>
                                    )}
                                    {clinchMap.get(s.id) === "eliminated" && (
                                      <span className="text-[8px] font-bold text-muted-foreground/40 bg-muted/10 px-1 rounded">✗</span>
                                    )}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center tabular-nums font-medium text-emerald-400 px-1 sm:px-4">
                                  {s.wins}
                                </TableCell>
                                <TableCell className="text-center tabular-nums font-medium text-red-400 px-1 sm:px-4">
                                  {s.losses}
                                </TableCell>
                                <TableCell className="text-center tabular-nums font-medium px-1 sm:px-4">
                                  {s.matchesPlayed > 0
                                    ? (s.winPct * 100).toFixed(0) + "%"
                                    : "-"}
                                </TableCell>
                                <TableCell className="text-center tabular-nums text-xs text-muted-foreground px-1 sm:px-4">
                                  {s.gb}
                                </TableCell>
                                <TableCell className={`text-center tabular-nums text-xs font-semibold ${streakColor} px-1 sm:px-4 hidden sm:table-cell`}>
                                  {s.streakLabel}
                                </TableCell>
                                <TableCell className="text-center px-1 sm:px-4 hidden sm:table-cell">
                                  {s.trend.length > 0 && <Sparkline results={s.trend} />}
                                </TableCell>
                                <TableCell className="text-center tabular-nums text-xs text-muted-foreground hidden sm:table-cell px-1 sm:px-4" style={zoneRightStyle}>
                                  {s.avgTime > 0 ? formatTime(s.avgTime) : "-"}
                                </TableCell>
                              </TableRow>
                            </React.Fragment>
                          );
                        })}
                        {stats.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={9}
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
