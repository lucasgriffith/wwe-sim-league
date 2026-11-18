import {
  getAllMatches,
  getCompletedSeasons,
  getTagTeams,
  getTiers,
  getWrestlers,
} from "@/lib/data/cached";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import Link from "next/link";

export default async function HistoryPage() {
  const seasons = await getCompletedSeasons();

  // Get champions for each completed season
  const seasonIds = (seasons ?? []).map((s) => s.id);
  const championsMap: Record<string, Array<{ tierName: string; holderName: string; tierNumber: number }>> = {};
  const matchCountMap: Record<string, number> = {};

  if (seasonIds.length > 0) {
    const [allMatchRows, tiers, wrestlers, tagTeams] = await Promise.all([
      getAllMatches(),
      getTiers(),
      getWrestlers(),
      getTagTeams(),
    ]);
    const seasonIdSet = new Set(seasonIds);
    const allMatches = allMatchRows.filter(
      (m) => m.played_at && seasonIdSet.has(m.season_id)
    );
    const finals = allMatches.filter((m) => m.match_phase === "final");

    const tierMap = Object.fromEntries(
      (tiers ?? []).map((t) => [t.id, { name: t.short_name || t.name, number: t.tier_number }])
    );
    const nameMap = Object.fromEntries([
      ...(wrestlers ?? []).map((w) => [w.id, w.name] as const),
      ...(tagTeams ?? []).map((t) => [t.id, t.name] as const),
    ]);

    // Match counts
    for (const m of allMatches ?? []) {
      matchCountMap[m.season_id] = (matchCountMap[m.season_id] ?? 0) + 1;
    }

    // Champions
    for (const f of finals ?? []) {
      if (!championsMap[f.season_id]) championsMap[f.season_id] = [];
      const winnerId = f.winner_wrestler_id || f.winner_tag_team_id;
      const tier = tierMap[f.tier_id];
      championsMap[f.season_id].push({
        tierName: tier?.name ?? "?",
        holderName: nameMap[winnerId ?? ""] ?? "?",
        tierNumber: tier?.number ?? 99,
      });
    }

    for (const sid of Object.keys(championsMap)) {
      championsMap[sid].sort((a, b) => a.tierNumber - b.tierNumber);
    }
  }

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <PageHeader
        kicker="The archive"
        title="Season History"
        stats={[
          { label: "Seasons", value: seasons?.length ?? 0 },
          { label: "Matches", value: Object.values(matchCountMap).reduce((a, b) => a + b, 0) },
        ]}
      />

      {seasons && seasons.length > 0 ? (
        <div className="space-y-5">
          {seasons.map((season) => {
            const champs = championsMap[season.id] ?? [];
            const matchCount = matchCountMap[season.id] ?? 0;
            const top = champs[0];
            return (
              <Link
                key={season.id}
                href={`/history/${season.id}`}
                className="group block border border-border bg-card transition-colors hover:border-gold/60"
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="halftone flex shrink-0 items-end gap-3 border-b border-border bg-background px-4 py-3 sm:w-44 sm:flex-col sm:items-start sm:justify-between sm:border-b-0 sm:border-r">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-gold/80">Season</p>
                      <p className="font-display text-7xl font-black leading-[0.85] tabular-nums text-foreground group-hover:text-gold">
                        {String(season.season_number).padStart(2, "0")}
                      </p>
                    </div>
                    <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {season.started_at && new Date(season.started_at).toLocaleDateString()}
                      {" – "}
                      {season.completed_at && new Date(season.completed_at).toLocaleDateString()}
                      <br />
                      {matchCount} matches
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 p-4">
                    {top ? (
                      <>
                        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                          {top.tierName} champion
                        </p>
                        <p className="mt-1 font-display text-3xl font-black leading-none [overflow-wrap:anywhere]">
                          {top.holderName}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No champions recorded.</p>
                    )}
                    {champs.length > 1 && (
                      <div className="mt-4 grid gap-x-6 gap-y-1.5 border-t border-border pt-3 sm:grid-cols-2 xl:grid-cols-3">
                        {champs.slice(1, 10).map((c, i) => (
                          <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate font-semibold">{c.holderName}</span>
                            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-gold/70">
                              {c.tierName}
                            </span>
                          </div>
                        ))}
                        {champs.length > 10 && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            +{champs.length - 10} more
                          </span>
                        )}
                      </div>
                    )}
                    <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground group-hover:text-gold">
                      Full recap →
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No history yet">
          Complete a season and its champions, brackets and recap are archived here.
        </EmptyState>
      )}
    </div>
  );
}
