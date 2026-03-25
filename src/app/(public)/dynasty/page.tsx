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

  // Get all wrestlers with career data
  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name, gender")
    .eq("is_active", true)
    .order("name");

  // Get all played matches
  const { data: allMatches } = await supabase
    .from("matches")
    .select("id, wrestler_a_id, wrestler_b_id, winner_wrestler_id, match_phase")
    .not("played_at", "is", null);

  // Get championship wins (finals)
  const { data: finals } = await supabase
    .from("matches")
    .select("id, winner_wrestler_id, tier_id, season_id, tiers(name, tier_number)")
    .eq("match_phase", "final")
    .not("played_at", "is", null);

  // Get tier assignments for highest tier tracking
  const { data: tierAssignments } = await supabase
    .from("tier_assignments")
    .select("wrestler_id, tiers(tier_number)")
    .not("wrestler_id", "is", null);

  // Compute dynasty stats
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

  // Sort by championships, then wins
  stats.sort(
    (a, b) =>
      b.championships - a.championships ||
      b.wins - a.wins ||
      b.winPct - a.winPct
  );

  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Dynasty Leaderboard</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-center">Titles</TableHead>
              <TableHead className="text-center">W</TableHead>
              <TableHead className="text-center">L</TableHead>
              <TableHead className="text-center">Win%</TableHead>
              <TableHead className="text-center">Best Tier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((s, i) => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <Link
                    href={`/roster/${s.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell className="text-center">
                  {s.championships > 0 ? (
                    <Badge className="bg-gold/20 text-gold">
                      {s.championships}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-center">{s.wins}</TableCell>
                <TableCell className="text-center">{s.losses}</TableCell>
                <TableCell className="text-center">
                  {s.totalMatches > 0
                    ? (s.winPct * 100).toFixed(0) + "%"
                    : "-"}
                </TableCell>
                <TableCell className="text-center">
                  {s.highestTier ? `T${s.highestTier}` : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
