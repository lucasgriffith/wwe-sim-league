"use client";

import { useState } from "react";
import Link from "next/link";
import { sortName } from "@/lib/utils/sort-name";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TitleDetail {
  name: string;
  season: number;
  isCurrent: boolean;
}

interface BaseStat {
  id: string;
  slug: string | null;
  name: string;
  gender: string;
  wins: number;
  losses: number;
  winPct: number;
  championships: number;
  titles: TitleDetail[];
  highestTier: number | null;
  totalMatches: number;
  playoffMatches: number;
  finalsAppearances: number;
  playoffWins: number;
  fastestWin: number | null;
  avgMatchTime: number | null;
  seasons: number;
  powerScore: number;
}

interface CurrentChampion {
  tierName: string;
  tierNumber: number;
  division: string;
  holderName: string;
  holderId: string;
  isTag: boolean;
}

interface WrestlerStat extends BaseStat {
  overallRating: number | null;
}

interface TagTeamStat extends BaseStat {
  memberA: string;
  memberB: string;
  isActive: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DynastyTabs({
  wrestlerStats,
  tagTeamStats,
  currentChampions = [],
  latestSeasonNumber,
}: {
  wrestlerStats: WrestlerStat[];
  tagTeamStats: TagTeamStat[];
  currentChampions?: CurrentChampion[];
  latestSeasonNumber?: number | null;
}) {
  const [tab, setTab] = useState<"wrestlers" | "tag-teams">("wrestlers");
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");

  type SortKey = "rank" | "name" | "titles" | "wins" | "losses" | "winPct" | "playoffs" | "avgMatchTime" | "highestTier" | "powerScore";
  const [sortKey, setSortKey] = useState<SortKey>("powerScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Default direction per column
      setSortDir(
        key === "name" ? "asc" :
        key === "highestTier" || key === "rank" ? "asc" :
        "desc" // powerScore, titles, wins, winPct etc. default descending
      );
    }
  }

  function sortFn<T extends BaseStat>(a: T, b: T): number {
    let cmp = 0;
    switch (sortKey) {
      case "rank":
        // Default: tier (lower = better), then win%
        cmp = (a.highestTier ?? 999) - (b.highestTier ?? 999);
        if (cmp === 0) cmp = b.winPct - a.winPct;
        break;
      case "name":
        cmp = sortName(a.name).localeCompare(sortName(b.name));
        break;
      case "titles":
        cmp = a.championships - b.championships;
        break;
      case "wins":
        cmp = a.wins - b.wins;
        break;
      case "losses":
        cmp = a.losses - b.losses;
        break;
      case "winPct":
        cmp = a.winPct - b.winPct;
        break;
      case "playoffs":
        cmp = a.playoffMatches - b.playoffMatches;
        break;
      case "avgMatchTime":
        cmp = (a.avgMatchTime ?? 0) - (b.avgMatchTime ?? 0);
        break;
      case "highestTier":
        // Lower tier number = better, so ascending = best first
        cmp = (a.highestTier ?? 999) - (b.highestTier ?? 999);
        break;
      case "powerScore":
        cmp = a.powerScore - b.powerScore;
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  }

  const filteredWrestlers = wrestlerStats
    .filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const matchesGender =
        genderFilter === "all" || s.gender === genderFilter;
      return matchesSearch && matchesGender;
    })
    .sort(sortFn);

  const filteredTagTeams = tagTeamStats
    .filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.memberA.toLowerCase().includes(search.toLowerCase()) ||
        s.memberB.toLowerCase().includes(search.toLowerCase());
      const matchesGender =
        genderFilter === "all" || s.gender === genderFilter;
      return matchesSearch && matchesGender;
    })
    .sort(sortFn);

  const pill = (active: boolean) =>
    `h-8 rounded-none px-3 font-mono text-[10px] uppercase tracking-[0.16em] ${
      active
        ? "border-gold bg-gold text-black font-bold hover:bg-gold"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-4">
      {/* Current Champions */}
      {currentChampions.length > 0 && (
        <section className="mb-6">
          <div className="rule-title mb-px flex items-baseline justify-between gap-4">
            <h2 className="text-2xl">Reigning Champions</h2>
            {latestSeasonNumber ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Season {latestSeasonNumber}
              </span>
            ) : null}
          </div>
          <div className="grid pl-px sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {currentChampions.map((c) => (
              <div key={c.holderId + c.tierName} className="-ml-px -mt-px flex items-center gap-3 border border-border bg-card px-3 py-2.5">
                <span className="w-9 shrink-0 bg-gold py-1 text-center font-mono text-[10px] font-bold text-black">
                  T{c.tierNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-extrabold leading-none truncate">
                    {c.holderName}
                  </p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-gold/70 truncate">
                    {c.tierName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab Toggle + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1.5">
          <Button
            variant={tab === "wrestlers" ? "default" : "outline"}
            size="sm"
            onClick={() => { setTab("wrestlers"); setSearch(""); setGenderFilter("all"); setSortKey("powerScore"); setSortDir("desc"); }}
            className={pill(tab === "wrestlers")}
          >
            Singles ({wrestlerStats.length})
          </Button>
          <Button
            variant={tab === "tag-teams" ? "default" : "outline"}
            size="sm"
            onClick={() => { setTab("tag-teams"); setSearch(""); setGenderFilter("all"); setSortKey("powerScore"); setSortDir("desc"); }}
            className={pill(tab === "tag-teams")}
          >
            Tag Teams ({tagTeamStats.length})
          </Button>
        </div>

        <div className="flex gap-1.5">
          {(tab === "wrestlers"
            ? (["all", "male", "female"] as const)
            : (["all", "male", "female", "mixed"] as const)
          ).map((g) => (
            <Button
              key={g}
              variant={genderFilter === g ? "default" : "outline"}
              size="sm"
              onClick={() => setGenderFilter(g)}
              className={pill(genderFilter === g)}
            >
              {g === "all" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
            </Button>
          ))}
        </div>

        <div className="relative max-w-xs flex-1 sm:ml-auto">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <Input
            placeholder={tab === "wrestlers" ? "Search wrestlers..." : "Search teams..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
      </div>

      {/* Wrestler Leaderboard */}
      {tab === "wrestlers" && (
        filteredWrestlers.length > 0 ? (
          <div className="border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b-2 border-foreground/80">
                  <SortableHead sortKey="powerScore" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-16 text-center">PWR</SortableHead>
                  <SortableHead sortKey="rank" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-10 text-center">Rank</SortableHead>
                  <SortableHead sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort}>Name</SortableHead>
                  <SortableHead sortKey="titles" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center">Titles</SortableHead>
                  <SortableHead sortKey="wins" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center">W</SortableHead>
                  <SortableHead sortKey="losses" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center">L</SortableHead>
                  <SortableHead sortKey="winPct" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center">Win%</SortableHead>
                  <SortableHead sortKey="playoffs" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center hidden sm:table-cell">Playoffs</SortableHead>
                  <SortableHead sortKey="avgMatchTime" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center hidden md:table-cell">Avg Time</SortableHead>
                  <SortableHead sortKey="highestTier" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center">Best Tier</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWrestlers.map((s, i) => (
                  <TableRow key={s.id} className="table-row-hover border-border/30">
                    <TableCell className="text-center">
                      <span className="text-base font-bold tabular-nums text-gold">
                        {s.powerScore}
                      </span>
                    </TableCell>
                    <TableCell className={`text-center font-display text-xl font-black tabular-nums ${i < 3 ? "text-gold" : "text-muted-foreground/70"}`}>
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/roster/${s.slug ?? s.id}`}
                        className="font-display text-lg font-extrabold leading-none hover:text-gold transition-colors"
                      >
                        {s.name}
                      </Link>
                      <Badge
                        variant="outline"
                        className={`ml-2 text-[9px] ${s.gender === "male" ? "border-blue-500/20 text-blue-400" : "border-purple-500/20 text-purple-400"}`}
                      >
                        {s.gender === "male" ? "M" : "F"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.titles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.titles.map((t, ti) => (
                            <Badge
                              key={ti}
                              className={`rounded-none font-mono text-[9px] uppercase tracking-wider ${
                                t.isCurrent
                                  ? "bg-gold text-black border-gold font-bold"
                                  : "bg-transparent text-muted-foreground border-border"
                              }`}
                            >
                              {t.name} (S{t.season})
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-emerald-400">{s.wins}</TableCell>
                    <TableCell className="text-center tabular-nums text-red-400">{s.losses}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {s.totalMatches > 0
                        ? (s.winPct * 100).toFixed(0) + "%"
                        : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className="text-center tabular-nums hidden sm:table-cell">
                      {s.playoffMatches > 0 ? s.playoffMatches : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-xs hidden md:table-cell">
                      {s.avgMatchTime ? formatTime(s.avgMatchTime) : <span className="text-muted-foreground/40">—</span>}
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
          <EmptyState label="wrestlers" />
        )
      )}

      {/* Tag Team Leaderboard */}
      {tab === "tag-teams" && (
        filteredTagTeams.length > 0 ? (
          <div className="border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b-2 border-foreground/80">
                  <SortableHead sortKey="powerScore" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-16 text-center">PWR</SortableHead>
                  <SortableHead sortKey="rank" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-10 text-center">Rank</SortableHead>
                  <SortableHead sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort}>Team</SortableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider hidden sm:table-cell">Members</TableHead>
                  <SortableHead sortKey="titles" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center">Titles</SortableHead>
                  <SortableHead sortKey="wins" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center">W</SortableHead>
                  <SortableHead sortKey="losses" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center">L</SortableHead>
                  <SortableHead sortKey="winPct" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center">Win%</SortableHead>
                  <SortableHead sortKey="avgMatchTime" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center hidden md:table-cell">Avg Time</SortableHead>
                  <SortableHead sortKey="highestTier" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center">Best Tier</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTagTeams.map((s, i) => {
                  const genderColor =
                    s.gender === "male"
                      ? "border-blue-500/20 text-blue-400"
                      : s.gender === "female"
                        ? "border-purple-500/20 text-purple-400"
                        : "border-amber-500/20 text-amber-400";
                  const genderLabel =
                    s.gender === "male" ? "M" : s.gender === "female" ? "F" : "Mix";

                  return (
                    <TableRow key={s.id} className="table-row-hover border-border/30">
                      <TableCell className="text-center">
                        <span className="text-base font-bold tabular-nums text-gold">
                          {s.powerScore}
                        </span>
                      </TableCell>
                      <TableCell className={`text-center font-display text-xl font-black tabular-nums ${i < 3 ? "text-gold" : "text-muted-foreground/70"}`}>
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/tag-teams/${s.id}`}
                          className="font-display text-lg font-extrabold leading-none hover:text-gold transition-colors"
                        >
                          {s.name}
                        </Link>
                        <Badge
                          variant="outline"
                          className={`ml-2 text-[9px] ${genderColor}`}
                        >
                          {genderLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                        {s.memberA} & {s.memberB}
                      </TableCell>
                      <TableCell>
                        {s.titles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {s.titles.map((t, ti) => (
                              <Badge
                                key={ti}
                                className={`rounded-none font-mono text-[9px] uppercase tracking-wider ${
                                  t.isCurrent
                                    ? "bg-gold text-black border-gold font-bold"
                                    : "bg-transparent text-muted-foreground border-border"
                                }`}
                              >
                                {t.name} (S{t.season})
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-emerald-400">{s.wins}</TableCell>
                      <TableCell className="text-center tabular-nums text-red-400">{s.losses}</TableCell>
                      <TableCell className="text-center tabular-nums">
                        {s.totalMatches > 0
                          ? (s.winPct * 100).toFixed(0) + "%"
                          : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-xs hidden md:table-cell">
                        {s.avgMatchTime ? formatTime(s.avgMatchTime) : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {s.highestTier ? (
                          <span className="text-xs font-medium">T{s.highestTier}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState label="tag teams" />
        )
      )}

      <p className="text-xs text-muted-foreground/60">
        Showing{" "}
        {tab === "wrestlers" ? filteredWrestlers.length : filteredTagTeams.length}{" "}
        of{" "}
        {tab === "wrestlers" ? wrestlerStats.length : tagTeamStats.length}
      </p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="halftone border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <h3 className="text-2xl">No Data Yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Complete a season to see {label} dynasty rankings.
      </p>
    </div>
  );
}

function SortableHead({
  sortKey,
  currentKey,
  dir,
  onSort,
  className = "",
  children,
}: {
  sortKey: string;
  currentKey: string;
  dir: "asc" | "desc";
  onSort: (key: any) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isActive = currentKey === sortKey;
  return (
    <TableHead
      className={`text-[11px] uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors ${className} ${isActive ? "text-foreground" : ""}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {isActive && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`shrink-0 transition-transform ${dir === "desc" ? "rotate-180" : ""}`}
          >
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
        )}
      </span>
    </TableHead>
  );
}
