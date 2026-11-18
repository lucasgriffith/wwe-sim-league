"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface ScheduleTier {
  id: string;
  name: string;
  shortName: string;
  tierNumber: number;
  division: string;
  bg: string;
  fg: string;
}

export interface ScheduleMatch {
  id: string;
  tierId: string;
  phase: string;
  pool: string | null;
  round: number | null;
  a: string;
  b: string;
  winner: "a" | "b" | null;
  seconds: number | null;
  stipulation: string | null;
  playedAt: number | null;
  day: string | null;
  dayLabel: string | null;
}

const PHASE_LABEL: Record<string, string> = {
  quarterfinal: "Quarterfinal",
  semifinal: "Semifinal",
  final: "Final",
  relegation: "Steel Cage",
};

const RESULTS_PAGE = 60;

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function context(m: ScheduleMatch) {
  if (m.phase !== "pool_play") return PHASE_LABEL[m.phase] ?? m.phase;
  return [m.pool ? `Pool ${m.pool}` : null, m.round ? `R${m.round}` : null].filter(Boolean).join(" · ");
}

export function ScheduleBoard({ matches, tiers }: { matches: ScheduleMatch[]; tiers: ScheduleTier[] }) {
  const [view, setView] = useState<"results" | "upcoming">("results");
  const [division, setDivision] = useState("all");
  const [tierId, setTierId] = useState("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(RESULTS_PAGE);

  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const divisions = useMemo(() => [...new Set(tiers.map((t) => t.division))], [tiers]);
  const tierOptions = division === "all" ? tiers : tiers.filter((t) => t.division === division);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches.filter((m) => {
      const tier = tierById.get(m.tierId);
      if (!tier) return false;
      if (division !== "all" && tier.division !== division) return false;
      if (tierId !== "all" && m.tierId !== tierId) return false;
      if (q && !m.a.toLowerCase().includes(q) && !m.b.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [matches, tierById, division, tierId, query]);

  const results = useMemo(
    () => filtered.filter((m) => m.playedAt).sort((x, y) => y.playedAt! - x.playedAt!),
    [filtered]
  );
  const upcoming = useMemo(() => filtered.filter((m) => !m.playedAt), [filtered]);

  const resultDays = useMemo(() => {
    const days: Array<{ day: string; label: string; rows: ScheduleMatch[] }> = [];
    for (const m of results.slice(0, shown)) {
      const last = days[days.length - 1];
      if (last && last.day === m.day) last.rows.push(m);
      else days.push({ day: m.day!, label: m.dayLabel!, rows: [m] });
    }
    return days;
  }, [results, shown]);

  const upcomingTiers = useMemo(() => {
    return tiers
      .map((tier) => ({
        tier,
        rows: upcoming
          .filter((m) => m.tierId === tier.id)
          .sort(
            (x, y) =>
              (x.round ?? 999) - (y.round ?? 999) || (x.pool ?? "").localeCompare(y.pool ?? "")
          ),
      }))
      .filter((g) => g.rows.length > 0);
  }, [tiers, upcoming]);

  const selectClass =
    "h-9 border border-border bg-card px-2 font-mono text-[11px] uppercase tracking-[0.1em] text-foreground";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex border border-border" role="tablist" aria-label="View">
          {(["results", "upcoming"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`h-9 px-4 font-display text-[15px] font-extrabold uppercase tracking-wider transition-colors ${
                view === v ? "bg-gold text-black" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "results" ? "Results" : "Upcoming"}
              <span className="ml-2 font-mono text-[10px] font-normal tabular-nums opacity-70">
                {v === "results" ? results.length : upcoming.length}
              </span>
            </button>
          ))}
        </div>
        <select
          aria-label="Division"
          value={division}
          onChange={(e) => {
            setDivision(e.target.value);
            setTierId("all");
            setShown(RESULTS_PAGE);
          }}
          className={selectClass}
        >
          <option value="all">All divisions</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Championship"
          value={tierId}
          onChange={(e) => {
            setTierId(e.target.value);
            setShown(RESULTS_PAGE);
          }}
          className={`${selectClass} max-w-[16rem]`}
        >
          <option value="all">All championships</option>
          {tierOptions.map((t) => (
            <option key={t.id} value={t.id}>
              T{t.tierNumber} · {t.shortName}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(RESULTS_PAGE);
          }}
          placeholder="Find a wrestler or team"
          aria-label="Find a wrestler or team"
          className="h-9 min-w-0 flex-[1_1_12rem] border border-border bg-card px-3 text-sm placeholder:text-muted-foreground/60 sm:max-w-xs"
        />
      </div>

      {view === "results" ? (
        results.length === 0 ? (
          <Empty>No results match those filters.</Empty>
        ) : (
          <div className="space-y-8">
            {resultDays.map((d) => (
              <section key={d.day}>
                <DayHeading label={d.label} count={results.filter((m) => m.day === d.day).length} />
                <ul className="border-t border-border">
                  {d.rows.map((m) => {
                    const tier = tierById.get(m.tierId)!;
                    return (
                      <li key={m.id} className="border-b border-border">
                        <Link
                          href={`/match/${m.id}`}
                          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-2 py-2 transition-colors hover:bg-card sm:grid-cols-[9rem_minmax(0,1fr)_8rem_3.5rem]"
                        >
                          <TierPlate tier={tier} />
                          <span className="min-w-0 truncate text-sm">
                            <span className="font-semibold text-foreground">{m.winner === "a" ? m.a : m.b}</span>
                            <span className="mx-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                              def.
                            </span>
                            <span className="text-muted-foreground">{m.winner === "a" ? m.b : m.a}</span>
                          </span>
                          <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:block">
                            {m.stipulation ?? context(m)}
                          </span>
                          <span className="text-right text-xs tabular-nums text-muted-foreground">
                            {m.seconds ? clock(m.seconds) : "–"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {results.length > shown && (
              <button
                onClick={() => setShown((n) => n + RESULTS_PAGE)}
                className="w-full border border-border py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-gold hover:text-gold"
              >
                Show older results · {results.length - shown} more
              </button>
            )}
          </div>
        )
      ) : upcomingTiers.length === 0 ? (
        <Empty>Nothing left to play for those filters.</Empty>
      ) : (
        <div className="grid gap-x-8 gap-y-8 lg:grid-cols-2">
          {upcomingTiers.map(({ tier, rows }) => (
            <section key={tier.id}>
              <div className="flex items-stretch border-b border-border">
                <span
                  className="flex w-10 shrink-0 items-center justify-center font-display text-lg font-black"
                  style={{ background: tier.bg, color: tier.fg }}
                >
                  {tier.tierNumber}
                </span>
                <Link
                  href={`/tiers/${tier.id}`}
                  className="min-w-0 flex-1 truncate px-3 py-1.5 font-display text-lg font-extrabold uppercase tracking-wide hover:text-gold"
                >
                  {tier.name}
                </Link>
                <span className="self-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {rows.length} left
                </span>
              </div>
              <ul>
                {rows.map((m) => (
                  <li
                    key={m.id}
                    className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 border-b border-border/60 px-2 py-1.5"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {context(m) || "–"}
                    </span>
                    <span className="min-w-0 truncate text-sm">
                      {m.a}
                      <span className="mx-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                        vs
                      </span>
                      {m.b}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function TierPlate({ tier }: { tier: ScheduleTier }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="flex h-5 w-7 shrink-0 items-center justify-center font-mono text-[10px] font-bold"
        style={{ background: tier.bg, color: tier.fg }}
      >
        T{tier.tierNumber}
      </span>
      <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground sm:inline">
        {tier.shortName}
      </span>
    </span>
  );
}

function DayHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-2xl">{label}</h2>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {count} {count === 1 ? "match" : "matches"}
      </span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="halftone border border-dashed border-border bg-card/40 px-6 py-14 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
