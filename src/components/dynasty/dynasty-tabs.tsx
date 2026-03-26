"use client";

import { useState } from "react";
import Link from "next/link";
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
  fastestWin: number | null;
  avgMatchTime: number | null;
  seasons: number;
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

  type SortKey = "rank" | "name" | "titles" | "wins" | "losses" | "winPct" | "playoffs" | "avgMatchTime" | "highestTier";
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Default direction per column
      setSortDir(
        key === "name" ? "asc" :
        key === "highestTier" || key === "rank" ? "asc" :
        "desc"
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
        cmp = a.name.localeCompare(b.name);
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

  return (
    <div className="space-y-4">
      {/* Current Champions */}
      {currentChampions.length > 0 && (
        <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gold mb-3">
            Current Champions{latestSeasonNumber ? ` — Season ${latestSeasonNumber}` : ""}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {currentChampions.map((c) => (
              <div
                key={c.holderId + c.tierName}
                className="flex items-center gap-2 rounded-md border border-gold/10 bg-background/50 px-3 py-2"
              >
                <span className="text-sm">🏆</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gold truncate">
                    {c.holderName}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {c.tierName}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground/50 font-mono">
                  T{c.tierNumber}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Toggle + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1.5">
          <Button
            variant={tab === "wrestlers" ? "default" : "outline"}
            size="sm"
            onClick={() => { setTab("wrestlers"); setSearch(""); setGenderFilter("all"); setSortKey("rank"); setSortDir("asc"); }}
            className={`text-xs ${tab !== "wrestlers" ? "border-border/40 text-muted-foreground hover:text-foreground" : ""}`}
          >
            Singles ({wrestlerStats.length})
          </Button>
          <Button
            variant={tab === "tag-teams" ? "default" : "outline"}
            size="sm"
            onClick={() => { setTab("tag-teams"); setSearch(""); setGenderFilter("all"); setSortKey("rank"); setSortDir("asc"); }}
            className={`text-xs ${tab !== "tag-teams" ? "border-border/40 text-muted-foreground hover:text-foreground" : ""}`}
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
              className={`text-xs ${genderFilter !== g ? "border-border/40 text-muted-foreground hover:text-foreground" : ""}`}
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
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <SortableHead sortKey="rank" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-12">Rank</SortableHead>
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
                    <TableCell className={`tabular-nums font-semibold ${i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "text-muted-foreground"}`}>
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/roster/${s.id}`}
                        className="font-medium hover:text-gold transition-colors"
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
                              className={`text-[10px] ${
                                t.isCurrent
                                  ? "bg-gold/15 text-gold border-gold/20 font-bold"
                                  : "bg-muted/30 text-muted-foreground/60 border-border/20"
                              }`}
                            >
                              {t.isCurrent ? "🏆 " : ""}{t.name} (S{t.season})
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
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <SortableHead sortKey="rank" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-12">Rank</SortableHead>
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
                      <TableCell className={`tabular-nums font-semibold ${i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "text-muted-foreground"}`}>
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{s.name}</span>
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
                                className={`text-[10px] ${
                                  t.isCurrent
                                    ? "bg-gold/15 text-gold border-gold/20 font-bold"
                                    : "bg-muted/30 text-muted-foreground/60 border-border/20"
                                }`}
                              >
                                {t.isCurrent ? "🏆 " : ""}{t.name} (S{t.season})
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
    <div className="rounded-xl border border-dashed border-border/40 bg-card/30 px-6 py-16 text-center">
      <h3 className="text-lg font-semibold">No Data Yet</h3>
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
