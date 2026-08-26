import { getAllMatches, getWrestlers } from "@/lib/data/cached";
import { CompareView } from "@/components/compare/compare-view";
import { sortByName } from "@/lib/utils/sort-name";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const [{ a, b }, wrestlers, allMatchRows] = await Promise.all([
    searchParams,
    getWrestlers(),
    getAllMatches(),
  ]);

  const playedMatches = allMatchRows.filter((m) => m.played_at);
  const involves = (m: (typeof playedMatches)[0], id: string) =>
    m.wrestler_a_id === id || m.wrestler_b_id === id;

  const matches =
    a && b
      ? playedMatches
          .filter((m) => involves(m, a) && involves(m, b))
          .sort(
            (x, y) =>
              new Date(y.played_at!).getTime() -
              new Date(x.played_at!).getTime()
          )
      : [];

  const allMatchesA = a ? playedMatches.filter((m) => involves(m, a)) : [];
  const allMatchesB = b ? playedMatches.filter((m) => involves(m, b)) : [];

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
        wrestlers={sortByName(wrestlers ?? [])}
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
