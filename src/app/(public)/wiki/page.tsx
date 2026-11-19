import { PageHeader } from "@/components/ui/page-header";
import { getTiers } from "@/lib/data/cached";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "divisions-and-tiers", label: "Divisions & Tiers" },
  { id: "season-structure", label: "Season Structure" },
  { id: "pool-play-and-standings", label: "Pool Play & Standings" },
  { id: "playoffs", label: "Playoffs" },
  { id: "relegation-and-promotion", label: "Relegation & Promotion" },
  { id: "tag-teams", label: "Tag Teams" },
  { id: "dynasty-tracking", label: "Dynasty Tracking" },
  { id: "elo-ratings-and-rankings", label: "Elo Ratings & Rankings" },
  { id: "royal-rumble-season-1", label: "Royal Rumble (Season 1)" },
  { id: "match-stipulation-reference", label: "Match Stipulation Reference" },
];

const DIVISION_ORDER = ["Men's Singles", "Women's Singles", "Men's Tag Teams", "Women's Tag Teams"];

export default async function WikiPage() {
  const tiers = await getTiers();
  const stipDivisions = DIVISION_ORDER.map((name) => ({
    name,
    tiers: tiers
      .filter((t) => (t.divisions as { name: string } | null)?.name === name)
      .sort((a, b) => a.tier_number - b.tier_number),
  })).filter((d) => d.tiers.length > 0);

  return (
    <div className="container max-w-screen-lg px-4 py-8 animate-fade-in">
      <PageHeader
        kicker="The rulebook"
        title="How It Works"
        description="Everything you need to know about the WWE 2K26 Simulation League."
        stats={[
          { label: "Divisions", value: 4 },
          { label: "Tiers", value: 28 },
        ]}
      />

      <nav aria-label="Contents" className="mb-10 border-l-2 border-gold/60 pl-3">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em]">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-muted-foreground transition-colors hover:text-gold">
                <span className="mr-1 text-gold/70 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="space-y-12 [counter-reset:rule]">
        {/* Overview */}
        <Section id="overview" title="Overview">
          <p>
            The WWE 2K26 Simulation League is a CPU-vs-CPU spectator league
            where every match is simulated by the game&apos;s AI. Wrestlers are
            organized into a tiered championship system with promotion and
            relegation — perform well and climb the ranks; finish at the bottom
            and drop down. Each season is a complete cycle of pool play,
            playoffs, and relegation.
          </p>
        </Section>

        {/* Divisions */}
        <Section id="divisions-and-tiers" title="Divisions &amp; Tiers">
          <p>
            The league is split into <strong>4 divisions</strong> containing a
            total of <strong>28 championship tiers</strong>:
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DivisionCard
              name="Men&apos;s Singles"
              tiers={16}
              format="2 Pools + 6-Person Playoff"
              color="blue"
              examples="Undisputed WWE Championship (T1) down to WWE Hardcore Championship (T16)"
            />
            <DivisionCard
              name="Women&apos;s Singles"
              tiers={7}
              format="2 Pools + 6-Person Playoff"
              color="purple"
              examples="WWE Women's Championship (T1) down to NXT UK Women's Championship (T7)"
            />
            <DivisionCard
              name="Men&apos;s Tag Teams"
              tiers={3}
              format="Round Robin + Final"
              color="emerald"
              examples="WWE Tag Team Championship (T1), NXT Tag (T2), WCW/ECW Tag (T3)"
            />
            <DivisionCard
              name="Women&apos;s Tag Teams"
              tiers={2}
              format="Round Robin + Final"
              color="orange"
              examples="WWE Women's Tag (T1), NXT Women's Tag (T2)"
            />
          </div>
          <p className="mt-4">
            Each tier represents a championship. The wrestler (or tag team) who
            wins the playoff final at the end of the season is crowned champion
            of that tier.
          </p>
        </Section>

        {/* Season Structure */}
        <Section id="season-structure" title="Season Structure">
          <p>Every season follows a fixed flow:</p>
          <div className="mt-4 space-y-3">
            <PhaseStep number={1} name="Setup" description="Wrestlers are assigned to tiers and split into pools (Pool A and Pool B). Schedules are generated automatically." />
            <PhaseStep number={2} name="Pool Play" description="Every wrestler plays every other wrestler in their pool exactly once (round robin). Standings are tracked live with wins, losses, and win percentage." />
            <PhaseStep number={3} name="Playoffs" description="The top performers from each pool qualify for a 6-person single-elimination playoff bracket. The winner is crowned champion of that tier." />
            <PhaseStep number={4} name="Relegation" description="The bottom 2 of each tier drop down and the top 2 of the tier below move up automatically. The next 2 up defend their spots in Steel Cage matches against the tier below's next challengers." />
            <PhaseStep number={5} name="Completed" description="Season is archived. All results, champions, and movements are recorded for dynasty tracking. Next season begins." />
          </div>
        </Section>

        {/* Pool Play */}
        <Section id="pool-play-and-standings" title="Pool Play &amp; Standings">
          <p>
            All tiers split their participants into two pools (Pool A and Pool
            B). Each wrestler/team faces every other in their pool once —
            this is a full round robin.
          </p>
          <SubSection title="Standings Columns">
            <ul>
              <li><strong>W / L</strong> — Wins and losses</li>
              <li><strong>Win%</strong> — Win percentage</li>
              <li><strong>GB</strong> — Games back from pool leader</li>
              <li><strong>Strk</strong> — Current streak (W3 = 3 wins in a row, L2 = 2 losses)</li>
              <li><strong>Avg Time</strong> — Average match duration</li>
            </ul>
          </SubSection>
          <SubSection title="Sort Order &amp; Tiebreakers">
            <p>Standings are sorted by:</p>
            <ol>
              <li><strong>Win percentage</strong> — primary sort</li>
              <li><strong>Games back</strong> — among equal win%, fewer games back ranks higher (only matters mid-season while match counts differ)</li>
              <li><strong>Head-to-head record</strong> — among tied wrestlers, only matches between them count (a mini-league among the tied group)</li>
              <li><strong>Average time of wins</strong> — shorter is better (quick wins are dominant wins)</li>
            </ol>
            <p>
              The same order is used everywhere: the standings page, tier pages,
              and playoff seeding.
            </p>
          </SubSection>
        </Section>

        {/* Playoffs */}
        <Section id="playoffs" title="Playoffs">
          <SubSection title="Singles Tiers (6-Person Bracket)">
            <p>Six wrestlers qualify for the playoff in each singles tier:</p>
            <ul>
              <li><strong>Top 2 from Pool A</strong> — automatic qualification</li>
              <li><strong>Top 2 from Pool B</strong> — automatic qualification</li>
              <li><strong>2 Wild Cards</strong> — the best remaining records across both pools</li>
            </ul>
            <p>All 6 are seeded 1–6 by overall record. The bracket works as follows:</p>
            <div className="mt-3 overflow-x-auto border border-border bg-card p-4 font-mono text-xs leading-relaxed">
              <pre className="whitespace-pre text-muted-foreground">{`  Quarterfinals        Semifinals          Final
  ┌──────────┐
  │ Seed 3   │─┐
  │ Seed 6   │ │     ┌──────────┐
  └──────────┘ ├────▸│ Winner   │
               │     │ Seed 2 │─┐
               │     └──────────┘ │  ┌──────────┐
  ┌──────────┐                    ├─▸│          │
  │ Seed 4   │─┐                  │  │ CHAMPION │
  │ Seed 5   │ │     ┌──────────┐ │  └──────────┘
  └──────────┘ ├────▸│ Winner   │─┘
               │     │ Seed 1 │
               │     └──────────┘
               │
               = First-round bye`}</pre>
            </div>
            <p className="mt-3">
              Seeds 1 and 2 receive first-round byes, rewarding the best
              regular season performance.
            </p>
          </SubSection>
          <SubSection title="Tag Team Tiers">
            <p>
              Tag tiers use a single round robin with no pools. The top 2 teams
              by record advance directly to a championship final.
            </p>
          </SubSection>
          <SubSection title="Match Stipulations">
            <p>
              Every championship has its own signature match, and its{" "}
              <strong>championship final</strong> is fought under it: the
              Intercontinental title is decided in a Ladder Match, the
              Hardcore title under Falls Count Anywhere, and so on. The full
              list is in the{" "}
              <a href="#match-stipulation-reference">stipulation reference</a>.
            </p>
            <p>
              Quarterfinals and semifinals each draw a random stipulation,
              never repeating one within a bracket. The draw leaves out the
              tier&apos;s signature match, which is saved for the final, and
              Steel Cage, which is saved for promotion and relegation matches.
            </p>
            <p>
              <strong>Exception:</strong> the Hardcore Championship is fought
              under Falls Count Anywhere in every match, pool play included.
            </p>
          </SubSection>
        </Section>

        {/* Relegation */}
        <Section id="relegation-and-promotion" title="Relegation &amp; Promotion">
          <p>
            After playoffs are complete, <strong>tier-wide final standings</strong>
            (both pools combined, with the playoff champion and runner-up
            lifted to the top two spots) determine who moves between tiers:
          </p>
          <div className="mt-4 space-y-3">
            <MovementRule
              type="auto-relegate"
              description="The bottom 2 of the tier automatically drop to the tier below. The champion and runner-up can never be relegated."
              color="red"
              arrow="↓"
            />
            <MovementRule
              type="auto-promote"
              description="The top 2 of the tier below automatically move up (Tier 1 has no tier above it)"
              color="emerald"
              arrow="↑"
            />
            <MovementRule
              type="relegation-playoff"
              description="3rd-from-bottom defends their spot against the tier below's 3rd place in a Steel Cage match; 4th-from-bottom defends against their 4th. Winner takes (or keeps) the higher tier spot, loser goes down."
              color="amber"
              arrow="×"
            />
          </div>
          <SubSection title="Example (Tier of 10)">
            <ol>
              <li><strong>1st-2nd</strong> — Champion &amp; runner-up, locked into the tier</li>
              <li><strong>3rd-6th</strong> — Safe, no movement</li>
              <li><strong>7th-8th</strong> — Steel Cage relegation playoff vs the tier below&apos;s 4th and 3rd</li>
              <li><strong>9th-10th</strong> — Auto-relegated to the tier below</li>
            </ol>
          </SubSection>
          <p className="mt-3">
            Relegation matches are <em>always</em> Steel Cage — no stipulation
            randomizer. After all matches are played the season can be
            completed, and next season&apos;s carry-forward starts from these
            standings with every promotion and relegation applied.
          </p>
        </Section>

        {/* Tag Teams */}
        <Section id="tag-teams" title="Tag Teams">
          <p>
            Wrestlers can compete in both singles and tag team divisions
            simultaneously. A wrestler might be in Men&apos;s Singles Tier 5
            while also competing with a partner in Men&apos;s Tag Tier 1.
            Tag team tiers run a single round robin (no pools) — the top two
            teams meet directly in a championship final, and the same
            promotion/relegation rules apply between tag tiers.
          </p>
        </Section>

        {/* Dynasty */}
        <Section id="dynasty-tracking" title="Dynasty Tracking">
          <p>
            The dynasty system tracks career-level statistics across all
            seasons:
          </p>
          <ul>
            <li><strong>Total Championships</strong> — playoff finals won</li>
            <li><strong>Career Record</strong> — cumulative wins and losses</li>
            <li><strong>Win Percentage</strong> — overall career win rate</li>
            <li><strong>Highest Tier Reached</strong> — the most prestigious tier a wrestler has competed in</li>
          </ul>
          <p>
            The dynasty leaderboard ranks everyone by a career power score
            built from titles, highest tier reached, win rate and playoff wins.
          </p>
        </Section>

        {/* Elo */}
        <Section id="elo-ratings-and-rankings" title="Elo Ratings &amp; Rankings">
          <p>
            Every wrestler and tag team carries an Elo rating, like a chess
            rating. Everyone starts from a seed based on their 2K overall
            (1200 at 80 OVR), and every match moves both ratings.
          </p>
          <ul>
            <li><strong>Opponent strength matters</strong> — beating someone rated above you is worth far more than beating someone below you, and losing to a lower-rated opponent costs more</li>
            <li><strong>Early matches swing harder</strong> — a wrestler&apos;s first 10 matches move their rating faster while it settles</li>
            <li><strong>Stakes count</strong> — playoff and relegation matches are worth 25% more, title matches 50% more</li>
          </ul>
          <p>
            The small gold number in front of a name is their rank within
            their own pool (men, women, men&apos;s tag, women&apos;s tag), shown
            for the top 25 like a college football poll.
          </p>
        </Section>

        {/* Royal Rumble */}
        <Section id="royal-rumble-season-1" title="Royal Rumble (Season 1)">
          <p>
            For the inaugural season, a Royal Rumble event is used as the
            initial seeding mechanism. The order in which wrestlers are
            eliminated determines their starting tier assignments — earlier
            eliminations go to lower tiers, later survivors to higher tiers.
            This gives every wrestler a starting position based on in-game
            performance, and the relegation system handles movement from there.
          </p>
        </Section>

        {/* Stipulations Reference */}
        <Section id="match-stipulation-reference" title="Match Stipulation Reference">
          <p>
            The match type for each championship final. Earlier playoff
            rounds draw at random; promotion and relegation matches between
            tiers are always Steel Cage.
          </p>
          <div className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {stipDivisions.map((d) => (
              <div key={d.name}>
                <h3 className="mb-2 font-mono! text-[11px] font-bold tracking-[0.18em] text-gold/90">
                  {d.name}
                </h3>
                <ul className="list-none! pl-0! space-y-0!">
                  {d.tiers.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="mr-2 font-mono text-[10px] text-muted-foreground tabular-nums">
                          T{t.tier_number}
                        </span>
                        {t.short_name || t.name}
                      </span>
                      <span className="shrink-0 font-display text-base font-bold uppercase leading-none text-foreground">
                        {t.fixed_stipulation ?? "Random draw"}
                        {t.fixed_stipulation === "Falls Count Anywhere" && (
                          <span className="ml-2 font-mono text-[9px] font-normal tracking-[0.14em] text-gold">
                            every match
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      </article>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 grid gap-x-8 gap-y-3 [counter-increment:rule] md:grid-cols-[5.5rem_minmax(0,1fr)]">
      <div
        aria-hidden
        className="font-display text-6xl font-black leading-[0.8] text-gold/90 tabular-nums before:content-[counter(rule,decimal-leading-zero)] md:text-7xl"
      />
      <div className="min-w-0">
        <h2 className="rule-title mb-4 text-3xl">{title}</h2>
        <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_em]:text-foreground/80 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_li]:marker:text-gold/70 [&_a]:text-gold [&_a]:underline">
          {children}
        </div>
      </div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-2 font-mono! text-[11px] font-bold tracking-[0.18em] text-gold/90">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DivisionCard({
  name,
  tiers,
  format,
  color,
  examples,
}: {
  name: string;
  tiers: number;
  format: string;
  color: string;
  examples: string;
}) {
  const colors: Record<string, string> = {
    blue: "border-l-blue-400 text-blue-400",
    purple: "border-l-purple-400 text-purple-400",
    emerald: "border-l-emerald-400 text-emerald-400",
    orange: "border-l-orange-400 text-orange-400",
  };
  return (
    <div className={`flex gap-4 border border-l-4 border-border bg-card p-4 ${colors[color] ?? ""}`}>
      <div className="shrink-0 text-center">
        <div className="font-display text-5xl font-black leading-[0.85] tabular-nums">{tiers}</div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">tiers</div>
      </div>
      <div className="min-w-0">
        <h4 className="font-display text-xl font-extrabold uppercase leading-none text-foreground">{name}</h4>
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{format}</p>
        <p className="mt-2 text-xs leading-snug text-muted-foreground/80">{examples}</p>
      </div>
    </div>
  );
}

function PhaseStep({
  number,
  name,
  description,
}: {
  number: number;
  name: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 border-b border-border pb-3 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-gold font-display text-xl font-black text-black">
        {number}
      </div>
      <div>
        <h4 className="font-display text-xl font-extrabold uppercase leading-none text-foreground">{name}</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function MovementRule({
  type,
  description,
  color,
  arrow,
}: {
  type: string;
  description: string;
  color: string;
  arrow: string;
}) {
  const colors: Record<string, string> = {
    red: "border-l-red-400 text-red-400",
    emerald: "border-l-emerald-400 text-emerald-400",
    amber: "border-l-amber-400 text-amber-400",
  };
  return (
    <div className={`flex items-start gap-4 border border-l-4 border-border bg-card p-3 ${colors[color] ?? ""}`}>
      <span className="w-6 shrink-0 text-center font-display text-2xl font-black leading-none">{arrow}</span>
      <div>
        <span className="font-display text-lg font-extrabold uppercase leading-none">
          {type.replace("-", " ")}
        </span>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
