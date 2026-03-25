import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function DynastyPage() {
  const supabase = await createClient();

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name, gender")
    .eq("is_active", true)
    .order("name");

  const { data: allMatches } = await supabase
    .from("matches")
    .select("id, wrestler_a_id, wrestler_b_id, winner_wrestler_id, match_phase")
    .not("played_at", "is", null);

  const { data: finals } = await supabase
    .from("matches")
    .select("id, winner_wrestler_id, tier_id, season_id, tiers(name, tier_number)")
    .eq("match_phase", "final")
    .not("played_at", "is", null);

  const { data: tierAssignments } = await supabase
    .from("tier_assignments")
    .select("wrestler_id, tiers(tier_number)")
    .not("wrestler_id", "is", null);

  const stats = (wrestlers ?? []).map((w) => {
    const matches = (allMatches ?? []).filter(
      (m) => m.wrestler_a_id === w.id || m.wrestler_b_id === w.id
    );
    const wins = matches.filter((m) => m.winner_wrestler_id === w.id).length;
    const losses = matches.length - wins;
    const championships = (finals ?? []).filter(
      (f) => f.winner_wrestler_id === w.id
    ).length;
    const highestTier = Math.min(
      ...(tierAssignments ?? [])
        .filter((a) => a.wrestler_id === w.id)
        .map((a) => (a.tiers as unknown as { tier_number: number })?.tier_number ?? 999),
      999
    );

    return {
      ...w,
      wins,
      losses,
      winPct: matches.length > 0 ? wins / matches.length : 0,
      championships,
      highestTier: highestTier === 999 ? null : highestTier,
      totalMatches: matches.length,
    };
  });

  stats.sort(
    (a, b) =>
      b.championships - a.championships ||
      b.wins - a.wins ||
      b.winPct - a.winPct
  );

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dynasty Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All-time rankings across all seasons
        </p>
      </div>

      {stats.length > 0 ? (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="w-10 text-[11px] uppercase tracking-wider">#</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Name</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Titles</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">W</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">L</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Win%</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Best Tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s, i) => (
                <TableRow key={s.id} className="table-row-hover border-border/30">
                  <TableCell className={`tabular-nums font-semibold ${i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "text-muted-foreground"}`}>
                    {i + 1}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/roster/${s.id}`}
                      className="font-medium hover:text-gold transition-colors"
                    >
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    {s.championships > 0 ? (
                      <Badge className="bg-gold/15 text-gold border-gold/20 text-xs font-bold">
                        {s.championships}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/40">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{s.wins}</TableCell>
                  <TableCell className="text-center tabular-nums">{s.losses}</TableCell>
                  <TableCell className="text-center tabular-nums">
                    {s.totalMatches > 0
                      ? (s.winPct * 100).toFixed(0) + "%"
                      : <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {s.highestTier ? (
                      <span className="text-xs font-medium">T{s.highestTier}</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/40 bg-card/30 px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No Data Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete a season to see dynasty rankings.
          </p>
        </div>
      )}
    </div>
  );
}
