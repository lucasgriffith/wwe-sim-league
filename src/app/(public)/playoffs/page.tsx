import Link from "next/link";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/page-header";
import { BracketView } from "@/components/playoffs/bracket-view";
import {
  getActivePlaySeason,
  getSeasonAssignments,
  getSeasonMatches,
  getTagTeams,
  getTiers,
  getWrestlers,
} from "@/lib/data/cached";
import { computeStandings, type StandingsRow } from "@/lib/standings/compute-standings";
import { computePlayoffSeeds, computeTagPlayoffSeeds } from "@/lib/playoffs/seeding";
import { generateBracket } from "@/lib/playoffs/bracket";
import { determineMovements } from "@/lib/relegation/determine-movements";
import { RELEGATION_STIPULATION, appliesToEveryMatch } from "@/lib/stipulations/types";
import { tierColor } from "@/lib/tiers/colors";

export const metadata = { title: "Playoffs" };

const DIVISION_ORDER = ["Men's Singles", "Women's Singles", "Men's Tag Teams", "Women's Tag Teams"];
const PLAYOFF_PHASES = ["quarterfinal", "semifinal", "final"];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface BracketNode {
  id: string | null;
  matchKey: string;
  round: string;
  participantA: { id: string; name: string; seed: number; image?: string | null } | null;
  participantB: { id: string; name: string; seed: number; image?: string | null } | null;
  winnerId: string | null;
  stipulation: string | null;
  matchTime: number | null;
  isPlayed: boolean;
  isBye: boolean;
}

interface CageMatch {
  key: string;
  defender: string;
  challenger: string;
  defenderImage: string | null;
  challengerImage: string | null;
  winner: string | null;
}

export default async function PlayoffsPage() {
  const season = await getActivePlaySeason();
  if (!season) {
    return (
      <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
        <PageHeader kicker="Postseason" title="Playoffs" />
        <EmptyState title="No active season">Brackets appear once a season is under way.</EmptyState>
      </div>
    );
  }

  const [tiers, assignments, matches, wrestlers, tagTeams] = await Promise.all([
    getTiers(),
    getSeasonAssignments(season.id),
    getSeasonMatches(season.id),
    getWrestlers(),
    getTagTeams(),
  ]);

  const names = new Map<string, string>();
  for (const w of wrestlers) names.set(w.id, w.name);
  for (const t of tagTeams) names.set(t.id, t.name);
  const nameOf = (id: string) => names.get(id) ?? "?";
  const images = new Map(wrestlers.map((w) => [w.id, w.image_url as string | null]));
  const imageOf = (id: string) => images.get(id) ?? null;

  const tierViews = tiers
    .map((tier) => {
      const division = (tier.divisions as { name: string } | null)?.name ?? "Other";
      const assigns = assignments.filter((a) => a.tier_id === tier.id);
      const pid = (a: (typeof assigns)[number]) => (a.wrestler_id || a.tag_team_id)!;
      const tierMatches = matches.filter((m) => m.tier_id === tier.id);
      const pool = tierMatches.filter((m) => m.match_phase === "pool_play");
      const decided = pool.filter((m) => m.winner_wrestler_id || m.winner_tag_team_id);
      const toResult = (m: (typeof decided)[number]) => ({
        id: m.id,
        wrestlerAId: (m.wrestler_a_id || m.tag_team_a_id)!,
        wrestlerBId: (m.wrestler_b_id || m.tag_team_b_id)!,
        winnerId: (m.winner_wrestler_id || m.winner_tag_team_id)!,
        matchTimeSeconds: m.match_time_seconds ?? 0,
      });
      const standingsFor = (p: string | null): StandingsRow[] =>
        computeStandings(
          assigns.filter((a) => p === null || a.pool === p).map((a) => ({ id: pid(a), name: nameOf(pid(a)) })),
          decided.filter((m) => p === null || m.pool === p).map(toResult)
        );

      const combined = standingsFor(null);
      const seeds = tier.has_pools
        ? computePlayoffSeeds(standingsFor("A"), standingsFor("B"))
        : computeTagPlayoffSeeds(combined);
      const seedOf = new Map(seeds.map((s) => [s.participantId, s.seed]));

      const real = tierMatches.filter((m) => PLAYOFF_PHASES.includes(m.match_phase));
      let bracket: BracketNode[] = [];
      let status: "live" | "projected" | "waiting" = "waiting";
      let champion: string | null = null;

      if (real.length > 0) {
        status = "live";
        const qf = real.filter((m) => m.match_phase === "quarterfinal");
        const sf = real.filter((m) => m.match_phase === "semifinal");
        bracket = real.map((m) => {
          const aId = m.wrestler_a_id || m.tag_team_a_id;
          const bId = m.wrestler_b_id || m.tag_team_b_id;
          const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
          const matchKey =
            m.bracket_key ??
            (m.match_phase === "quarterfinal"
              ? `QF${qf.indexOf(m) + 1}`
              : m.match_phase === "semifinal"
                ? `SF${sf.indexOf(m) + 1}`
                : "Final");
          if (m.match_phase === "final" && winnerId) champion = nameOf(winnerId);
          return {
            id: m.id,
            matchKey,
            round: m.match_phase,
            participantA: aId ? { id: aId, name: nameOf(aId), seed: seedOf.get(aId) ?? 0, image: imageOf(aId) } : null,
            participantB: bId ? { id: bId, name: nameOf(bId), seed: seedOf.get(bId) ?? 0, image: imageOf(bId) } : null,
            winnerId,
            stipulation: m.stipulation,
            matchTime: m.match_time_seconds,
            isPlayed: !!m.played_at,
            isBye: false,
          };
        });
      } else if (decided.length > 0) {
        status = "projected";
        bracket = generateBracket(seeds).map((bm) => ({
          id: null,
          matchKey: bm.matchKey,
          round: bm.round,
          participantA: bm.seedA
            ? { id: bm.seedA.participantId, name: bm.seedA.name, seed: bm.seedA.seed, image: imageOf(bm.seedA.participantId) }
            : null,
          participantB: bm.seedB
            ? { id: bm.seedB.participantId, name: bm.seedB.name, seed: bm.seedB.seed, image: imageOf(bm.seedB.participantId) }
            : null,
          winnerId: null,
          stipulation:
            bm.round === "final" || appliesToEveryMatch(tier.fixed_stipulation)
              ? tier.fixed_stipulation
              : null,
          matchTime: null,
          isPlayed: false,
          isBye: false,
        }));
      }

      return {
        tier,
        division,
        entrants: assigns.length,
        combined,
        bracket,
        status,
        champion,
        poolPlayed: pool.filter((m) => m.played_at).length,
        poolTotal: pool.length,
        cageMatches: tierMatches.filter((m) => m.match_phase === "relegation"),
      };
    })
    .filter((v) => v.entrants > 0);

  const divisions = DIVISION_ORDER.map((name) => {
    const views = tierViews
      .filter((v) => v.division === name)
      .sort((a, b) => a.tier.tier_number - b.tier.tier_number);

    // Steel Cage matches between neighbouring tiers: the real ones once they
    // exist, otherwise who would be in them on current standings
    const cages: Array<{ higher: (typeof views)[number]; lower: (typeof views)[number]; projected: boolean; matches: CageMatch[] }> = [];
    for (let i = 0; i < views.length - 1; i++) {
      const higher = views[i];
      const lower = views[i + 1];
      if (higher.cageMatches.length > 0) {
        cages.push({
          higher,
          lower,
          projected: false,
          matches: higher.cageMatches.map((m) => {
            const aId = (m.wrestler_a_id || m.tag_team_a_id)!;
            const bId = (m.wrestler_b_id || m.tag_team_b_id)!;
            const w = m.winner_wrestler_id || m.winner_tag_team_id;
            return { key: m.id, defender: nameOf(aId), challenger: nameOf(bId), defenderImage: imageOf(aId), challengerImage: imageOf(bId), winner: w ? nameOf(w) : null };
          }),
        });
        continue;
      }
      if (higher.status === "waiting" || lower.status === "waiting") continue;
      const asFinal = (rows: StandingsRow[]) =>
        rows.map((r, idx) => ({ participantId: r.participantId, name: r.name, finalRank: idx + 1 }));
      const pending = determineMovements(
        { tierId: higher.tier.id, tierNumber: higher.tier.tier_number, divisionId: higher.tier.division_id },
        { tierId: lower.tier.id, tierNumber: lower.tier.tier_number, divisionId: lower.tier.division_id },
        asFinal(higher.combined),
        asFinal(lower.combined)
      ).filter((mv) => mv.needsMatch && mv.opponentName);
      if (pending.length > 0) {
        cages.push({
          higher,
          lower,
          projected: true,
          matches: pending.map((mv) => ({
            key: mv.participantId,
            defender: mv.name,
            challenger: mv.opponentName!,
            defenderImage: imageOf(mv.participantId),
            challengerImage: mv.opponentId ? imageOf(mv.opponentId) : null,
            winner: null,
          })),
        });
      }
    }
    return { name, views, cages };
  }).filter((d) => d.views.length > 0);

  const live = tierViews.filter((v) => v.status === "live").length;
  const crowned = tierViews.filter((v) => v.champion).length;
  const poolPlayed = tierViews.reduce((n, v) => n + v.poolPlayed, 0);
  const poolTotal = tierViews.reduce((n, v) => n + v.poolTotal, 0);

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <PageHeader
        kicker={`Season ${season.season_number} · postseason`}
        title="Playoffs"
        description={
          live > 0
            ? "Every bracket in the league. Under each one are the Steel Cage matches for a place in that tier."
            : "Brackets are set when pool play ends. Until then this is the field as it stands: who would be in, and against whom, if the season ended today. Under each bracket are the Steel Cage matches for a place in that tier."
        }
        stats={
          live > 0
            ? [
                { label: "Brackets", value: live },
                { label: "Champions", value: crowned },
              ]
            : [{ label: "Pool play", value: `${poolTotal ? Math.round((poolPlayed / poolTotal) * 100) : 0}%` }]
        }
      />

      <nav aria-label="Divisions" className="mb-8 flex flex-wrap gap-x-5 gap-y-1 border-l-2 border-gold/60 pl-3 font-mono text-[11px] uppercase tracking-[0.14em]">
        {divisions.map((d) => (
          <a key={d.name} href={`#${slugify(d.name)}`} className="text-muted-foreground transition-colors hover:text-gold">
            {d.name}
          </a>
        ))}
      </nav>

      <div className="space-y-14">
        {divisions.map((d) => (
          <section key={d.name} id={slugify(d.name)} className="scroll-mt-28">
            <SectionTitle aside={`${d.views.length} ${d.views.length === 1 ? "title" : "titles"}`}>{d.name}</SectionTitle>

            <div className={`grid gap-5 ${d.views[0].tier.has_pools ? "xl:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
              {d.views.map((v) => {
                const c = tierColor(v.tier.slug ?? v.tier.name);
                const cage = d.cages.find((cg) => cg.higher.tier.id === v.tier.id);
                return (
                  <article key={v.tier.id} className="min-w-0 border border-border bg-card">
                    <header className="flex items-stretch border-b border-border">
                      <span
                        className="flex w-11 shrink-0 items-center justify-center font-display text-xl font-black"
                        style={{ background: c.bg, color: c.fg }}
                      >
                        {v.tier.tier_number}
                      </span>
                      <div className="min-w-0 flex-1 px-3 py-2">
                        <Link
                          href={`/tiers/${v.tier.id}`}
                          className="block truncate font-display text-xl font-extrabold uppercase leading-tight tracking-wide hover:text-gold"
                        >
                          {v.tier.name}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {v.tier.fixed_stipulation && <span className="text-wwe-red">{appliesToEveryMatch(v.tier.fixed_stipulation) ? "Every match" : "Final"} · {v.tier.fixed_stipulation}</span>}
                          <span>
                            {v.champion
                              ? `Champion · ${v.champion}`
                              : v.status === "live"
                                ? "In progress"
                                : v.status === "projected"
                                  ? `Projected · ${v.poolPlayed}/${v.poolTotal} played`
                                  : "No results yet"}
                          </span>
                        </div>
                      </div>
                    </header>
                    <div className="p-3">
                      {v.bracket.length > 0 ? (
                        <BracketView
                          tierName={v.tier.short_name || v.tier.name}
                          isTagFinal={!v.bracket.some((b) => b.round !== "final")}
                          matches={v.bracket}
                        />
                      ) : (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          The field appears after the first result.
                        </p>
                      )}
                    </div>
                    {cage && (
                      <div className="border-t border-border p-3">
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[10px] uppercase tracking-[0.2em]">
                          <span className="text-amber-400">Promotion / relegation</span>
                          <span className="tracking-[0.14em] text-muted-foreground">
                            {cage.projected ? "As it stands · " : ""}winner takes the T{v.tier.tier_number} place
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {cage.matches.map((m) => (
                            <div key={m.key} className="border border-amber-400/60 bg-background">
                              <div className="bg-amber-400 px-2 py-1 text-center font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-black">
                                {RELEGATION_STIPULATION}
                              </div>
                              {[
                                { name: m.defender, image: m.defenderImage, tag: `T${cage.higher.tier.tier_number} · defending` },
                                { name: m.challenger, image: m.challengerImage, tag: `T${cage.lower.tier.tier_number} · challenging` },
                              ].map((side, i) => {
                                const won = m.winner === side.name;
                                const lost = !!m.winner && !won;
                                return (
                                  <div
                                    key={i}
                                    className={`relative flex h-9 items-center gap-2 px-2 ${i === 0 ? "border-b border-border" : ""} ${won ? "bg-foreground/[0.06]" : ""}`}
                                  >
                                    {won && <span className="absolute inset-y-0 left-0 w-[3px] bg-amber-400" />}
                                    {side.image && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={side.image}
                                        alt=""
                                        loading="lazy"
                                        className={`h-6 w-6 shrink-0 bg-muted object-cover object-top ${lost ? "opacity-40 grayscale" : ""}`}
                                      />
                                    )}
                                    <span className={`min-w-0 flex-1 truncate text-sm ${won ? "font-bold" : lost ? "text-muted-foreground/50" : "font-medium"}`}>
                                      {side.name}
                                    </span>
                                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/80">
                                      {side.tag}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

          </section>
        ))}
      </div>
    </div>
  );
}
