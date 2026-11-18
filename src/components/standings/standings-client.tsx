"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Standing, TierStandings } from "@/app/(public)/standings/page";
import { FormDots } from "@/components/ui/form-dots";
import { ChampionBadge } from "@/components/ui/champion-badge";
import type { ChampionInfo } from "@/lib/champions";
import { computeClinchStatus } from "@/lib/standings/clinch";
import { RankBadge } from "@/components/ui/rank-badge";
import { CutLine, ZoneLegend, ZoneTags, ZONE_RANK_COLOR, ZONE_STRIPE, zoneBand } from "@/components/standings/zone-ui";
import { tierColor } from "@/lib/tiers/colors";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const divColors: Record<string, { pill: string; active: string }> = {
  "Men's Singles": { pill: "border-blue-500/30 text-blue-400 hover:bg-blue-500/10", active: "bg-blue-500/15 border-blue-500/40 text-blue-400" },
  "Women's Singles": { pill: "border-purple-500/30 text-purple-400 hover:bg-purple-500/10", active: "bg-purple-500/15 border-purple-500/40 text-purple-400" },
  "Men's Tag Teams": { pill: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10", active: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" },
  "Women's Tag Teams": { pill: "border-orange-500/30 text-orange-400 hover:bg-orange-500/10", active: "bg-orange-500/15 border-orange-500/40 text-orange-400" },
};

interface Props {
  divisions: Array<{
    name: string;
    tiers: TierStandings[];
  }>;
  champions?: Record<string, ChampionInfo>;
}

export function StandingsClient({ divisions, champions = {} }: Props) {
  const [activeDivision, setActiveDivision] = useState(divisions[0]?.name ?? "");
  const [view, setView] = useState<"pools" | "tier">("pools");

  const activeTiers = divisions.find((d) => d.name === activeDivision)?.tiers ?? [];

  const viewBtn = (active: boolean) =>
    `h-8 px-3 font-mono text-[10px] uppercase tracking-[0.16em] border -ml-px first:ml-0 transition-colors ${
      active
        ? "border-gold bg-gold text-black font-bold"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {/* Division jump pills */}
        <div className="flex flex-wrap gap-2">
          {divisions.map((div) => {
            const isActive = activeDivision === div.name;
            const c = divColors[div.name] ?? divColors["Men's Singles"];
            return (
              <button
                key={div.name}
                onClick={() => setActiveDivision(div.name)}
                className={`border px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActive ? c.active : `${c.pill} bg-transparent`
                }`}
              >
                {div.name}
                <span className="ml-1.5 text-[10px] opacity-60">{div.tiers.length}</span>
              </button>
            );
          })}
        </div>
        <div className="flex" role="group" aria-label="Table layout">
          <button type="button" className={viewBtn(view === "pools")} onClick={() => setView("pools")}>
            Pools
          </button>
          <button type="button" className={viewBtn(view === "tier")} onClick={() => setView("tier")}>
            Tier table
          </button>
        </div>
      </div>

      <div className="mb-6">
        <ZoneLegend />
      </div>

      {/* Tier standings */}
      <div className="space-y-8">
        {activeTiers.map((tier) => {
          const color = tierColor(tier.tierSlug ?? tier.tierName);
          const allRows = tier.pools.flatMap((p) => p.standings);
          const byId = new Map(allRows.map((r) => [r.id, r]));
          const clinched = new Set<string>();
          for (const p of tier.pools) {
            const rounds = p.standings.length > 1 ? p.standings.length - 1 : 0;
            const map = computeClinchStatus(
              p.standings.map((s) => ({ participantId: s.id, wins: s.wins, losses: s.losses })),
              rounds
            );
            map.forEach((status, id) => {
              if (status === "clinched") clinched.add(id);
            });
          }
          const combined = tier.combinedIds.flatMap((id) => {
            const r = byId.get(id);
            return r ? [{ ...r, gb: r.tierGb }] : [];
          });
          const showCombined = view === "tier" || !tier.hasPools;
          return (
            <div key={tier.tierId} className="bg-card">
              <Link
                href={`/tiers/${tier.tierSlug ?? tier.tierId}`}
                className="cut-plate inline-flex max-w-full flex-col gap-x-3 py-2 pl-4 pr-12 transition-opacity hover:opacity-90 sm:flex-row sm:items-baseline"
                style={{ background: color.bg, color: color.fg }}
              >
                <span className="font-mono text-xs font-bold tracking-widest whitespace-nowrap">TIER {tier.tierNumber}</span>
                <span className="font-display text-xl font-black sm:text-2xl">{tier.tierName}</span>
              </Link>

              {showCombined ? (
                <StandingsTable
                  label={tier.hasPools ? "Tier table · both pools" : undefined}
                  standings={combined}
                  clinched={clinched}
                  champions={champions}
                />
              ) : (
                <div className="grid md:grid-cols-2 gap-y-2 md:gap-x-3 md:gap-y-0">
                  {tier.pools.map((p) => (
                    <StandingsTable
                      key={p.pool ?? "all"}
                      label={p.pool ? `Pool ${p.pool}` : undefined}
                      standings={p.standings}
                      clinched={clinched}
                      champions={champions}
                    />
                  ))}
                </div>
              )}

              {tier.below && tier.comingUp.length > 0 && (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-dashed border-emerald-500/40 px-3 py-2">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                    ↑ Coming up from tier {tier.below.tierNumber}
                  </span>
                  <span className="font-display text-base font-extrabold uppercase leading-none text-foreground/70">
                    {tier.comingUp.map((c, i) => (
                      <React.Fragment key={c.name}>
                        {i > 0 && <span className="text-muted-foreground/50"> · </span>}
                        {c.href ? (
                          <Link href={c.href} className="hover:text-gold">{c.name}</Link>
                        ) : (
                          c.name
                        )}
                      </React.Fragment>
                    ))}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
                    if the season ended today
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {activeTiers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No tiers with assignments in this division.
          </p>
        )}
      </div>
    </div>
  );
}

function StandingsTable({
  standings,
  label,
  clinched,
  champions = {},
}: {
  standings: Standing[];
  label?: string;
  clinched: Set<string>;
  champions?: Record<string, ChampionInfo>;
}) {
  return (
    <div className="overflow-x-auto">
      {label && (
        <div className="px-3 pt-3">
          <h3 className="rule-title text-lg">{label}</h3>
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 border-b border-border/20">
            <th className="px-1 sm:px-3 py-2 text-left w-8">#</th>
            <th className="px-1 sm:px-3 py-2 text-left">Name</th>
            <th className="px-1 sm:px-3 py-2 text-center w-8">W</th>
            <th className="px-1 sm:px-3 py-2 text-center w-8">L</th>
            <th className="px-1 sm:px-3 py-2 text-right w-12">Win%</th>
            <th className="px-1 sm:px-3 py-2 text-center w-10 hidden sm:table-cell">GB</th>
            <th className="px-1 sm:px-3 py-2 text-right w-12 hidden sm:table-cell">Elo</th>
            <th className="px-1 sm:px-3 py-2 text-center w-10">Strk</th>
            <th className="px-1 sm:px-3 py-2 text-center w-12 hidden sm:table-cell">Form</th>
            <th className="px-1 sm:px-3 py-2 text-right w-14 hidden sm:table-cell">Avg Time</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            // Zone comes from the server: playoff spots are per-pool, but
            // wild cards and relegation zones are tier-wide (see zones.ts)
            const band = zoneBand(s.zone);
            const rankColor = ZONE_RANK_COLOR[band];
            const leftBorder = ZONE_STRIPE[band];

            const streakColor = s.streak.startsWith("W")
              ? "text-emerald-400"
              : s.streak.startsWith("L")
                ? "text-red-400"
                : "text-muted-foreground/30";

            return (
              <React.Fragment key={s.id}>
                <CutLine prev={i > 0 ? standings[i - 1].zone : null} zone={s.zone} colSpan={10} />
                <tr className="border-b border-border/40 text-sm">
                  <td className={`font-display px-1 sm:px-3 py-2 text-xl font-black ${rankColor} ${leftBorder}`}>
                    {i + 1}
                  </td>
                  <td className="px-1 sm:px-3 py-2">
                    <span className="font-display flex items-center gap-2 text-lg font-extrabold leading-none">
                      {s.memberImages ? (
                        <span className="flex items-center -space-x-1.5 shrink-0">
                          {s.memberImages.map((img, mi) => (
                            img ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img key={mi} src={img} alt="" className="h-7 w-7 object-cover object-top ring-1 ring-background" />
                            ) : (
                              <span key={mi} className="h-7 w-7 bg-muted flex items-center justify-center text-[8px] text-muted-foreground ring-1 ring-background">?</span>
                            )
                          ))}
                        </span>
                      ) : s.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.imageUrl} alt="" className="h-7 w-7 object-cover object-top shrink-0" />
                      ) : (
                        <span className="h-7 w-7 bg-muted flex items-center justify-center text-[8px] text-muted-foreground shrink-0">?</span>
                      )}
                      {s.linkHref ? (
                        <Link
                          href={s.linkHref}
                          className="hover:text-gold transition-colors"
                        >
                          <RankBadge rank={s.eloRank} />
                          {s.name}
                        </Link>
                      ) : (
                        <span>{s.name}</span>
                      )}
                      {champions[s.id] && (
                        <ChampionBadge
                          beltName={champions[s.id].beltName}
                          beltImageUrl={champions[s.id].beltImageUrl}
                        />
                      )}
                      <ZoneTags zone={s.zone} clinched={clinched.has(s.id)} promotion={s.promotion} />
                    </span>
                  </td>
                  <td className={`px-1 sm:px-3 py-2 text-center tabular-nums font-medium ${s.wins > 0 ? "text-emerald-400" : "text-muted-foreground/40"}`}>
                    {s.wins}
                  </td>
                  <td className={`px-1 sm:px-3 py-2 text-center tabular-nums font-medium ${s.losses > 0 ? "text-red-400" : "text-muted-foreground/40"}`}>
                    {s.losses}
                  </td>
                  <td className="px-1 sm:px-3 py-2 text-right tabular-nums font-medium">
                    {s.wins + s.losses > 0
                      ? `${(s.winPct * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="px-1 sm:px-3 py-2 text-center tabular-nums text-xs text-muted-foreground hidden sm:table-cell">
                    {s.gb}
                  </td>
                  <td className="px-1 sm:px-3 py-2 text-right tabular-nums text-xs font-semibold text-gold/80 hidden sm:table-cell">
                    {s.elo ?? "—"}
                  </td>
                  <td className={`px-1 sm:px-3 py-2 text-center tabular-nums text-xs font-semibold ${streakColor}`}>
                    {s.streak}
                  </td>
                  <td className="px-1 sm:px-3 py-2 text-center hidden sm:table-cell">
                    {s.trend.length > 0 && <FormDots results={s.trend} />}
                  </td>
                  <td className="px-1 sm:px-3 py-2 text-right tabular-nums text-xs text-muted-foreground hidden sm:table-cell">
                    {s.avgTime > 0 ? formatTime(s.avgTime) : "—"}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
          {standings.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matches played yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
