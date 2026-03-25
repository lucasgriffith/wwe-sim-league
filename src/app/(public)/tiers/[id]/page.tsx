import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

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

  const { data: tier } = await supabase
    .from("tiers")
    .select("*, divisions(name, gender, division_type)")
    .eq("id", id)
    .single();

  if (!tier) notFound();

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
      .select("id, pool, seed, wrestler_id, tag_team_id, wrestlers(id, name), tag_teams(id, name)")
      .eq("season_id", activeSeason.id)
      .eq("tier_id", id)
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
      .eq("tier_id", id)
      .order("round_number")
      .order("pool");
    matches = data ?? [];
  }

  const division = tier.divisions as { name: string; gender: string; division_type: string };

  const pools = tier.has_pools ? ["A", "B"] : [null];
  const standingsByPool = pools.map((pool) => {
    const poolAssignments = assignments.filter((a) =>
      pool ? a.pool === pool : true
    );
    const poolMatches = matches.filter(
      (m) => m.match_phase === "pool_play" && (pool ? m.pool === pool : true)
    );

    const stats = poolAssignments.map((a) => {
      const participantId = a.wrestler_id || a.tag_team_id;
      const name = a.wrestlers?.name || a.tag_teams?.name || "Unknown";

      const played = poolMatches.filter(
        (m) =>
          m.wrestler_a_id === participantId ||
          m.wrestler_b_id === participantId
      );
      const completedMatches = played.filter((m) => m.played_at);
      const wins = completedMatches.filter(
        (m) => m.winner_wrestler_id === participantId
      ).length;
      const losses = completedMatches.length - wins;
      const totalTime = completedMatches.reduce(
        (sum, m) => sum + (m.match_time_seconds ?? 0),
        0
      );

      return {
        id: participantId!,
        name,
        wins,
        losses,
        winPct: completedMatches.length > 0 ? wins / completedMatches.length : 0,
        totalTime,
        matchesPlayed: completedMatches.length,
      };
    });

    stats.sort((a, b) => b.winPct - a.winPct || a.totalTime - b.totalTime);

    return { pool, stats };
  });

  const totalMatches = matches.filter((m) => m.match_phase === "pool_play").length;
  const playedMatches = matches.filter(
    (m) => m.match_phase === "pool_play" && m.played_at
  ).length;
  const progressPct = totalMatches > 0 ? (playedMatches / totalMatches) * 100 : 0;

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <Link
        href="/tiers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Tiers
      </Link>

      {/* Hero */}
      <div className="mt-6 mb-8 rounded-xl border border-border/40 bg-gradient-to-r p-6"
        style={{
          backgroundImage: `linear-gradient(135deg, ${tier.color}08 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <Badge
            variant="outline"
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: tier.color ?? undefined, borderColor: tier.color ? `${tier.color}40` : undefined }}
          >
            Tier {tier.tier_number}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">{division.name}</Badge>
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{tier.name}</h1>
        {tier.fixed_stipulation && (
          <p className="mt-2 text-sm text-muted-foreground">
            All matches: <span className="text-wwe-red font-medium">{tier.fixed_stipulation}</span>
          </p>
        )}
      </div>

      {activeSeason ? (
        <>
          <div className="mb-6 flex items-center gap-4">
            <Badge variant="outline" className="text-xs">Season {activeSeason.season_number}</Badge>
            <div className="flex items-center gap-2 flex-1">
              <div className="h-1.5 flex-1 max-w-48 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gold transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {playedMatches}/{totalMatches}
              </span>
            </div>
          </div>

          {standingsByPool.map(({ pool, stats }) => (
            <div key={pool ?? "all"} className="mb-8">
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
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="w-10 text-[11px] uppercase tracking-wider">#</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Name</TableHead>
                      <TableHead className="text-center text-[11px] uppercase tracking-wider">W</TableHead>
                      <TableHead className="text-center text-[11px] uppercase tracking-wider">L</TableHead>
                      <TableHead className="text-center text-[11px] uppercase tracking-wider">Win%</TableHead>
                      <TableHead className="text-center text-[11px] uppercase tracking-wider">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((s, i) => (
                      <TableRow key={s.id} className="table-row-hover border-border/30">
                        <TableCell className={`tabular-nums font-semibold ${i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "text-muted-foreground"}`}>
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-center tabular-nums">{s.wins}</TableCell>
                        <TableCell className="text-center tabular-nums">{s.losses}</TableCell>
                        <TableCell className="text-center tabular-nums">
                          {s.matchesPlayed > 0
                            ? (s.winPct * 100).toFixed(0) + "%"
                            : "-"}
                        </TableCell>
                        <TableCell className="text-center tabular-nums text-muted-foreground">
                          {s.totalTime > 0 ? formatTime(s.totalTime) : "-"}
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
            </div>
          ))}
        </>
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
