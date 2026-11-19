"use client";

import Link from "next/link";
import type { ResultImpact, SideImpact } from "@/app/result-impact";
import { MatchCardExport } from "./match-card-export";
/* eslint-disable @next/next/no-img-element */

export interface ResultSide {
  id: string;
  name: string;
  href: string;
  image: string | null;
  memberImages?: [string | null, string | null];
}

export interface RecordedResult {
  matchId: string;
  winner: ResultSide;
  loser: ResultSide;
  seconds: number;
  tierNumber: number | null;
  tierName: string;
  pool: string | null;
  plate: { bg: string; fg: string };
  milestones: string[];
  /** undefined while it is being worked out, null if it could not be */
  impact: ResultImpact | null | undefined;
}

function clock(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function Photo({ side, dim }: { side: ResultSide; dim?: boolean }) {
  const tone = dim ? "opacity-50 grayscale" : "";
  if (side.memberImages) {
    return (
      <div className={`flex -space-x-3 ${tone}`}>
        {side.memberImages.map((src, i) =>
          src ? (
            <img key={i} src={src} alt="" className="h-14 w-14 border-2 border-background bg-muted object-cover object-top" />
          ) : (
            <div key={i} className="h-14 w-14 border-2 border-background bg-muted" />
          )
        )}
      </div>
    );
  }
  return side.image ? (
    <img src={side.image} alt="" className={`h-20 w-20 bg-muted object-cover object-top ${tone}`} />
  ) : (
    <div className={`flex h-20 w-20 items-center justify-center bg-muted font-display text-3xl font-black text-muted-foreground/40 ${tone}`}>
      {side.name.charAt(0)}
    </div>
  );
}

/**
 * Shown in place of the Up Next card once a result is saved: who won, and
 * what it did to both sides' Elo, Elo rank and place in the table. It stays
 * until dismissed, so there is time to read it and to undo a mis-tap.
 */
export function ResultCard({
  result,
  onNext,
  onUndo,
  busy,
  hasNext,
}: {
  result: RecordedResult;
  onNext: () => void;
  onUndo: () => void;
  busy: boolean;
  hasNext: boolean;
}) {
  const { winner, loser, impact } = result;
  const upset = !!impact && impact.winnerProb < 0.4;

  return (
    <div className="cut-br relative overflow-hidden bg-card animate-fade-in">
      <div aria-hidden="true" className="halftone absolute inset-0" />

      <div className="relative flex items-stretch">
        <div className="cut-plate min-w-0 max-w-full py-3 pl-4 pr-12" style={{ background: result.plate.bg, color: result.plate.fg }}>
          <span className="block font-mono text-[10px] font-bold tracking-widest">
            RESULT{result.tierNumber ? ` · TIER ${result.tierNumber}` : ""}
            {result.pool ? ` · POOL ${result.pool}` : ""}
          </span>
          <span className="font-display block text-xl font-black sm:truncate sm:text-3xl">{result.tierName}</span>
        </div>
      </div>

      <div className="relative flex items-center gap-4 px-4 pb-3 pt-4">
        <div className="relative shrink-0">
          <Photo side={winner} />
          <span className="absolute -bottom-1 left-0 right-0 bg-gold py-px text-center font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-black">
            Winner
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <Link href={winner.href} className="font-display block text-3xl font-black leading-none hover:text-gold sm:text-4xl [overflow-wrap:anywhere]">
            {winner.name}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
            <span className="font-mono text-[10px] uppercase tracking-wider">def.</span>
            <Link href={loser.href} className="hover:text-foreground">{loser.name}</Link>
            <span className="tabular-nums text-foreground">{clock(result.seconds)}</span>
          </div>
          {upset && (
            <span className="mt-2 inline-block bg-wwe-red px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white">
              Upset · had a {Math.round(impact!.winnerProb * 100)}% chance
            </span>
          )}
        </div>
      </div>

      {/* What it changed */}
      <div className="relative border-t border-border">
        <div className="grid grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))] items-center gap-x-3 px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          <span />
          <span>Elo</span>
          <span>Elo rank</span>
          <span>{impact?.tableLabel ?? "Table"}</span>
        </div>
        {[
          { side: winner, data: impact?.winner, won: true },
          { side: loser, data: impact?.loser, won: false },
        ].map(({ side, data, won }) => (
          <ImpactRow
            key={side.id}
            name={side.name}
            data={data}
            won={won}
            pending={impact === undefined}
            tableSize={impact?.tableSize ?? 0}
          />
        ))}
        {impact === null && (
          <p className="px-4 pb-2 text-xs text-muted-foreground">
            The result is saved. The rating changes could not be loaded; they are on the Schedule page.
          </p>
        )}
      </div>

      {result.milestones.length > 0 && (
        <ul className="relative border-t border-border px-4 py-2">
          {result.milestones.map((m) => (
            <li key={m} className="flex items-baseline gap-2 py-0.5 text-sm">
              <span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] bg-gold" />
              {m}
            </li>
          ))}
        </ul>
      )}

      <div className="relative flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <button
          onClick={onNext}
          disabled={busy}
          autoFocus
          className="h-9 bg-gold px-5 font-display text-base font-extrabold uppercase tracking-wider text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {hasNext ? "Next match" : "Done"}
        </button>
        <Link
          href={`/match/${result.matchId}`}
          className="flex h-9 items-center border border-border px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          Match page
        </Link>
        <MatchCardExport
          winnerName={winner.name}
          loserName={loser.name}
          matchTime={clock(result.seconds)}
          tierName={result.tierName}
          tierNumber={result.tierNumber ?? 0}
          winnerImageUrl={winner.image}
        />
        <button
          onClick={onUndo}
          disabled={busy}
          className="ml-auto h-9 px-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-red-400 disabled:opacity-50"
        >
          {busy ? "Undoing" : "Undo result"}
        </button>
      </div>
    </div>
  );
}

function ImpactRow({
  name,
  data,
  won,
  pending,
  tableSize,
}: {
  name: string;
  data: SideImpact | undefined;
  won: boolean;
  pending: boolean;
  tableSize: number;
}) {
  const good = "text-emerald-400";
  const bad = "text-red-400";
  const dash = <span className="text-muted-foreground/50">{pending ? "…" : "–"}</span>;
  const rankMoved = data && data.rankBefore !== null && data.rankBefore !== data.rankAfter;
  const placeMoved = data && data.placeBefore !== null && data.placeAfter !== null && data.placeBefore !== data.placeAfter;

  return (
    <div className="grid grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))] items-baseline gap-x-3 border-t border-border/60 px-4 py-2 text-sm tabular-nums">
      <span className={`min-w-0 truncate ${won ? "font-bold" : "text-muted-foreground"}`}>
        {name}
        {data && (
          <span className="ml-2 font-mono text-[10px] font-normal text-muted-foreground">
            {data.wins}-{data.losses}
          </span>
        )}
      </span>

      <span>
        {data ? (
          <>
            <span className="font-display text-xl font-extrabold leading-none">{data.rating}</span>
            <span className={`ml-1.5 font-mono text-[11px] ${data.delta >= 0 ? good : bad}`}>
              {data.delta >= 0 ? "+" : "−"}
              {Math.abs(data.delta)}
            </span>
          </>
        ) : (
          dash
        )}
      </span>

      <span>
        {data ? (
          <>
            <span className="font-display text-xl font-extrabold leading-none">#{data.rankAfter}</span>
            {rankMoved ? (
              <span className={`ml-1.5 font-mono text-[11px] ${data.rankAfter < data.rankBefore! ? good : bad}`}>
                {data.rankAfter < data.rankBefore! ? "▲" : "▼"}
                {Math.abs(data.rankAfter - data.rankBefore!)}
              </span>
            ) : data.rankBefore === null ? (
              <span className="ml-1.5 font-mono text-[10px] uppercase text-muted-foreground">new</span>
            ) : null}
          </>
        ) : (
          dash
        )}
      </span>

      <span>
        {data && data.placeAfter !== null ? (
          <>
            <span className="font-display text-xl font-extrabold leading-none">{ordinal(data.placeAfter)}</span>
            {tableSize > 0 && <span className="ml-1 font-mono text-[10px] text-muted-foreground">of {tableSize}</span>}
            {placeMoved && (
              <span className={`ml-1.5 font-mono text-[11px] ${data.placeAfter < data.placeBefore! ? good : bad}`}>
                {data.placeAfter < data.placeBefore! ? "▲" : "▼"}
                {Math.abs(data.placeAfter - data.placeBefore!)}
              </span>
            )}
          </>
        ) : (
          dash
        )}
      </span>
    </div>
  );
}
