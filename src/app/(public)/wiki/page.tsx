export default function WikiPage() {
  return (
    <div className="container max-w-screen-md px-4 py-8 animate-fade-in">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">How It Works</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything you need to know about the WWE 2K26 Simulation League
        </p>
      </div>

      <article className="prose-wiki space-y-10">
        {/* Overview */}
        <Section title="Overview">
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
        <Section title="Divisions &amp; Tiers">
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
        <Section title="Season Structure">
          <p>Every season follows a fixed flow:</p>
          <div className="mt-4 space-y-3">
            <PhaseStep number={1} name="Setup" description="Wrestlers are assigned to tiers and split into pools (Pool A and Pool B). Schedules are generated automatically." />
            <PhaseStep number={2} name="Pool Play" description="Every wrestler plays every other wrestler in their pool exactly once (round robin). Standings are tracked live with wins, losses, and win percentage." />
            <PhaseStep number={3} name="Playoffs" description="The top performers from each pool qualify for a 6-person single-elimination playoff bracket. The winner is crowned champion of that tier." />
            <PhaseStep number={4} name="Relegation" description="Last place in each pool drops a tier. 2nd-from-bottom plays a relegation playoff — losers face the tier below's promotion winners in a Steel Cage match." />
            <PhaseStep number={5} name="Completed" description="Season is archived. All results, champions, and movements are recorded for dynasty tracking. Next season begins." />
          </div>
        </Section>

        {/* Pool Play */}
        <Section title="Pool Play &amp; Standings">
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
              <li><strong>Games Back (GB)</strong> — primary sort, lower is better</li>
              <li><strong>Win percentage</strong> — secondary tiebreak</li>
              <li><strong>Average match time</strong> — for wrestlers above .500, shorter avg time is better (dominant wins). Below .500, longer avg time is better (put up more of a fight)</li>
            </ol>
          </SubSection>
        </Section>

        {/* Playoffs */}
        <Section title="Playoffs">
          <SubSection title="Singles Tiers (6-Person Bracket)">
            <p>Six wrestlers qualify for the playoff in each singles tier:</p>
            <ul>
              <li><strong>Top 2 from Pool A</strong> — automatic qualification</li>
              <li><strong>Top 2 from Pool B</strong> — automatic qualification</li>
              <li><strong>2 Wild Cards</strong> — the best remaining records across both pools</li>
            </ul>
            <p>All 6 are seeded 1–6 by overall record. The bracket works as follows:</p>
            <div className="mt-3 rounded-lg border border-border/40 bg-card/30 p-4 font-mono text-xs leading-relaxed">
              <pre className="whitespace-pre text-muted-foreground">{`  Quarterfinals        Semifinals          Final
  ┌──────────┐
  │ Seed 3   │─┐
  │ Seed 6   │ │     ┌──────────┐
  └──────────┘ ├────▸│ Winner   │
               │     │ Seed 2 ★ │─┐
               │     └──────────┘ │  ┌──────────┐
  ┌──────────┐                    ├─▸│          │
  │ Seed 4   │─┐                  │  │ CHAMPION │
  │ Seed 5   │ │     ┌──────────┐ │  └──────────┘
  └──────────┘ ├────▸│ Winner   │─┘
               │     │ Seed 1 ★ │
               │     └──────────┘
               │
               ★ = First-round bye`}</pre>
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
              Each playoff match receives a random stipulation drawn from a pool
              of 18 match types (Extreme Rules, Hell in a Cell, Ladder Match,
              TLC, etc.). No stipulation is used twice within the same
              tier&apos;s bracket.
            </p>
            <p>
              <strong>Exception:</strong> The Hardcore tier (Men&apos;s Singles
              T16) always uses Falls Count Anywhere for every match.
            </p>
          </SubSection>
        </Section>

        {/* Relegation */}
        <Section title="Relegation &amp; Promotion">
          <p>
            After playoffs are complete, final pool standings determine who
            moves between tiers. Movement is based on <strong>per-pool
            finishing position</strong>:
          </p>
          <div className="mt-4 space-y-3">
            <MovementRule
              type="auto-relegate"
              description="Last place in each pool automatically drops to the tier below"
              color="red"
              arrow="↓"
            />
            <MovementRule
              type="auto-promote"
              description="1st place in each pool of the tier below automatically moves up (except Tier 1 has no promotion)"
              color="emerald"
              arrow="↑"
            />
            <MovementRule
              type="relegation-playoff"
              description="2nd-from-bottom in each pool plays each other. The loser then faces the promotion winner from the tier below in a Steel Cage match. Winner earns/keeps the higher tier spot."
              color="amber"
              arrow="⚔️"
            />
          </div>
          <SubSection title="Example (Pool of 6)">
            <ol>
              <li><strong>1st-2nd</strong> — Qualify for playoffs</li>
              <li><strong>3rd</strong> — Wild card contention for playoffs</li>
              <li><strong>4th</strong> — Safe, no movement</li>
              <li><strong>5th</strong> — Relegation playoff (plays other pool&apos;s 5th, loser faces Steel Cage)</li>
              <li><strong>6th</strong> — Auto-relegated to tier below</li>
            </ol>
          </SubSection>
          <p className="mt-3">
            Relegation Steel Cage matches are <em>always</em> Steel Cage — no
            stipulation randomizer. After all matches are played, tier
            assignments are finalized for the next season. The &quot;safe&quot;
            zone in the middle grows as pool sizes increase.
          </p>
        </Section>

        {/* Tag Teams */}
        <Section title="Tag Teams">
          <p>
            Wrestlers can compete in both singles and tag team divisions
            simultaneously. A wrestler might be in Men&apos;s Singles Tier 5
            while also competing with a partner in Men&apos;s Tag Tier 1.
            Tag team tiers use the same pool system as singles — two pools
            with round-robin play, 6-person playoff brackets, and the same
            promotion/relegation rules.
          </p>
        </Section>

        {/* Dynasty */}
        <Section title="Dynasty Tracking">
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
            The dynasty leaderboard ranks all wrestlers by championships won,
            then by wins, then by win percentage.
          </p>
        </Section>

        {/* Royal Rumble */}
        <Section title="Royal Rumble (Season 1)">
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
        <Section title="Match Stipulation Reference">
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              "Extreme Rules", "Inferno", "Three Stages of Hell",
              "I Quit", "Brawl", "Dumpster Match",
              "Ambulance Match", "Casket Match", "Steel Cage",
              "Hell in a Cell", "Table Match", "Ladder Match",
              "TLC", "Submission Match", "Falls Count Anywhere",
              "Iron Man", "Last Man Standing", "No Holds Barred",
            ].map((stip) => (
              <div
                key={stip}
                className="rounded-md border border-border/30 bg-card/30 px-3 py-2 text-xs"
              >
                {stip}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Relegation matches always use Steel Cage. The Hardcore tier always
            uses Falls Count Anywhere.
          </p>
        </Section>
      </article>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_em]:text-foreground/80 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_a]:text-gold [&_a]:underline">
        {children}
      </div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
      <div className="space-y-2">
        {children}
      </div>
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
    blue: "from-blue-500/8 to-transparent border-blue-500/15 text-blue-400",
    purple: "from-purple-500/8 to-transparent border-purple-500/15 text-purple-400",
    emerald: "from-emerald-500/8 to-transparent border-emerald-500/15 text-emerald-400",
    orange: "from-orange-500/8 to-transparent border-orange-500/15 text-orange-400",
  };
  const c = colors[color] ?? "";
  return (
    <div className={`rounded-lg border bg-gradient-to-br p-4 ${c}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">{name}</h4>
        <span className="text-[10px] font-mono">{tiers} tiers</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{format}</p>
      <p className="mt-2 text-[10px] text-muted-foreground/60">{examples}</p>
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
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/10 text-xs font-bold text-gold">
        {number}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-foreground">{name}</h4>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
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
    red: "border-red-500/20 bg-red-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
  };
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${colors[color] ?? ""}`}>
      <span className="text-lg">{arrow}</span>
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {type.replace("-", " ")}
        </span>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
