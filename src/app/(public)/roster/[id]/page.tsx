import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function WrestlerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: wrestler } = await supabase
    .from("wrestlers")
    .select("*")
    .eq("id", id)
    .single();

  if (!wrestler) notFound();

  const { data: assignments } = await supabase
    .from("tier_assignments")
    .select("*, tiers(name, tier_number, division_id), seasons(season_number, status)")
    .eq("wrestler_id", id)
    .order("created_at", { ascending: false });

  const { data: matchesA } = await supabase
    .from("matches")
    .select("id, winner_wrestler_id")
    .eq("wrestler_a_id", id)
    .not("played_at", "is", null);

  const { data: matchesB } = await supabase
    .from("matches")
    .select("id, winner_wrestler_id")
    .eq("wrestler_b_id", id)
    .not("played_at", "is", null);

  const allMatches = [...(matchesA ?? []), ...(matchesB ?? [])];
  const wins = allMatches.filter((m) => m.winner_wrestler_id === id).length;
  const losses = allMatches.length - wins;
  const winPct = allMatches.length > 0 ? ((wins / allMatches.length) * 100).toFixed(1) : null;

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

      <div className="mt-6 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{wrestler.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs ${
              wrestler.gender === "male"
                ? "border-blue-500/30 text-blue-400"
                : "border-purple-500/30 text-purple-400"
            }`}
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
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 stagger-children">
        <Card className="card-hover bg-gradient-to-br from-amber-500/5 to-amber-500/0 border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Overall Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tabular-nums">
              {wrestler.overall_rating ?? <span className="text-muted-foreground/30">—</span>}
            </p>
          </CardContent>
        </Card>
        <Card className="card-hover bg-gradient-to-br from-blue-500/5 to-blue-500/0 border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Career Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tabular-nums">
              <span className="text-emerald-400">{wins}</span>
              <span className="text-muted-foreground/40 mx-1">-</span>
              <span className="text-red-400">{losses}</span>
            </p>
            {winPct && (
              <p className="mt-1 text-xs text-muted-foreground">
                {winPct}% win rate
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="card-hover bg-gradient-to-br from-purple-500/5 to-purple-500/0 border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Seasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tabular-nums">
              {assignments?.length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {assignments && assignments.length > 0 && (
        <div className="mt-8 animate-slide-up">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tier History
          </h2>
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Season</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Pool</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-border/20 table-row-hover">
                    <td className="px-4 py-3 text-sm tabular-nums">
                      Season{" "}
                      {(a.seasons as { season_number: number })?.season_number}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {(a.tiers as { name: string })?.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{a.pool || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
