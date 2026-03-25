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

  // Get active season
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("*")
    .neq("status", "completed")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get assignments for this tier in the active season
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

  // Get matches for this tier in the active season
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

  // Compute standings from matches
  const wrestlerMap = new Map(
    assignments
      .filter((a) => a.wrestlers)
      .map((a) => [a.wrestler_id!, a.wrestlers!.name])
  );
  const tagTeamMap = new Map(
    assignments
      .filter((a) => a.tag_teams)
      .map((a) => [a.tag_team_id!, a.tag_teams!.name])
  );

  // Build standings per pool
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

  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <Link
        href="/tiers"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to Tiers
      </Link>

      <div className="mt-4 mb-8">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            style={{ color: tier.color ?? undefined, borderColor: tier.color ?? undefined }}
          >
            Tier {tier.tier_number}
          </Badge>
          <Badge variant="secondary">{division.name}</Badge>
        </div>
        <h1 className="mt-2 text-3xl font-bold">{tier.name}</h1>
        {tier.fixed_stipulation && (
          <p className="mt-1 text-sm text-muted-foreground">
            All matches: {tier.fixed_stipulation}
          </p>
        )}
      </div>

      {activeSeason ? (
        <>
          <div className="mb-6 flex items-center gap-4">
            <Badge variant="outline">Season {activeSeason.season_number}</Badge>
            <span className="text-sm text-muted-foreground">
              {playedMatches}/{totalMatches} matches played
            </span>
          </div>

          {standingsByPool.map(({ pool, stats }) => (
            <div key={pool ?? "all"} className="mb-8">
              <h2 className="mb-3 text-lg font-semibold">
                {pool ? `Pool ${pool}` : "Standings"}
              </h2>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">W</TableHead>
                      <TableHead className="text-center">L</TableHead>
                      <TableHead className="text-center">Win%</TableHead>
                      <TableHead className="text-center">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-center">{s.wins}</TableCell>
                        <TableCell className="text-center">{s.losses}</TableCell>
                        <TableCell className="text-center">
                          {s.matchesPlayed > 0
                            ? (s.winPct * 100).toFixed(0) + "%"
                            : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {s.totalTime > 0 ? formatTime(s.totalTime) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {stats.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              No Active Season
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create a new season to start assigning wrestlers to this tier.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
