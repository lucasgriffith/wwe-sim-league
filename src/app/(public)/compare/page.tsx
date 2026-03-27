import { createClient } from "@/lib/supabase/server";
import { CompareView } from "@/components/compare/compare-view";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  const supabase = await createClient();

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name, gender, overall_rating")
    .order("name");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matches: any[] = [];
  if (a && b) {
    const { data } = await supabase
      .from("matches")
      .select("*, seasons(season_number)")
      .or(
        `and(wrestler_a_id.eq.${a},wrestler_b_id.eq.${b}),and(wrestler_a_id.eq.${b},wrestler_b_id.eq.${a})`
      )
      .not("played_at", "is", null)
      .order("played_at", { ascending: false });
    matches = data ?? [];
  }

  // Get career stats for both wrestlers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allMatchesA: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allMatchesB: any[] = [];

  if (a) {
    const { data } = await supabase
      .from("matches")
      .select("winner_wrestler_id")
      .or(`wrestler_a_id.eq.${a},wrestler_b_id.eq.${a}`)
      .not("played_at", "is", null);
    allMatchesA = data ?? [];
  }
  if (b) {
    const { data } = await supabase
      .from("matches")
      .select("winner_wrestler_id")
      .or(`wrestler_a_id.eq.${b},wrestler_b_id.eq.${b}`)
      .not("played_at", "is", null);
    allMatchesB = data ?? [];
  }

  const wrestlerA = wrestlers?.find((w) => w.id === a);
  const wrestlerB = wrestlers?.find((w) => w.id === b);

  const statsA = a
    ? {
        wins: allMatchesA.filter((m) => m.winner_wrestler_id === a).length,
        losses: allMatchesA.length - allMatchesA.filter((m) => m.winner_wrestler_id === a).length,
        total: allMatchesA.length,
      }
    : null;

  const statsB = b
    ? {
        wins: allMatchesB.filter((m) => m.winner_wrestler_id === b).length,
        losses: allMatchesB.length - allMatchesB.filter((m) => m.winner_wrestler_id === b).length,
        total: allMatchesB.length,
      }
    : null;

  const h2hA = matches.filter((m) => m.winner_wrestler_id === a).length;
  const h2hB = matches.filter((m) => m.winner_wrestler_id === b).length;

  return (
    <div className="container max-w-screen-lg px-4 py-8 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Head-to-Head</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Compare two wrestlers side by side
      </p>
      <CompareView
        wrestlers={wrestlers ?? []}
        selectedA={a ?? ""}
        selectedB={b ?? ""}
        wrestlerA={wrestlerA ?? null}
        wrestlerB={wrestlerB ?? null}
        statsA={statsA}
        statsB={statsB}
        h2hA={h2hA}
        h2hB={h2hB}
        h2hMatches={matches}
      />
    </div>
  );
}
