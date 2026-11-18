"use client";

import { useRef, useState } from "react";
/* eslint-disable @next/next/no-img-element */

/**
 * Rating trajectory — accent-colored line over a dashed 1200 baseline, a
 * win/loss dot at every match, and a crosshair + tooltip (with the
 * opponent's photo) that follows the pointer.
 *
 * The line's SVG stretches to the container (preserveAspectRatio none),
 * which would squash circles into ovals — so the dots and tooltip are HTML
 * overlays positioned in percent/pixels, immune to the stretch.
 */

interface Point {
  rating: number;
  label: string; // tooltip text, e.g. "1234 — def. Mosh (S1)"
  won: boolean;
  opponentImage?: string | null;
  /** Rank within the pool after this match */
  rank?: number;
  /** A championship final: "won" the title, or "lost" the final */
  title?: "won" | "lost";
}

const W = 280;
const PAD = 6;

export function RatingSparkline({
  points,
  height = 56,
}: {
  points: Point[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [mode, setMode] = useState<"rating" | "rank">("rating");

  if (points.length < 2) return null;

  const hasRanks = points.every((p) => p.rank != null && p.rank > 0);
  const showRank = mode === "rank" && hasRanks;

  // In rank mode the series is plotted upside down so #1 sits at the top;
  // the rest of the chart only ever sees a value where "higher is better"
  const value = (p: Point) => (showRank ? -(p.rank as number) : p.rating);
  const values = points.map(value);
  const min = showRank ? Math.min(...values) : Math.min(...values, 1200);
  const max = showRank ? Math.max(...values) : Math.max(...values, 1200);
  const span = Math.max(max - min, showRank ? 4 : 20);

  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  // viewBox height maps 1:1 to CSS pixels, so y works for HTML overlays too
  const y = (r: number) => PAD + (1 - (r - min) / span) * (height - PAD * 2);
  const pct = (i: number) => (x(i) / W) * 100;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(value(p)).toFixed(1)}`)
    .join(" ");
  const baselineY = y(1200);
  const last = points[points.length - 1];

  function handlePointerMove(e: React.PointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(frac * (points.length - 1));
    setHovered(Math.max(0, Math.min(points.length - 1, idx)));
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHovered(null)}
    >
      {hasRanks && (
        <div className="absolute -top-9 right-0 z-20 flex" role="group" aria-label="Chart series">
          {(["rating", "rank"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`-ml-px border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] first:ml-0 ${
                mode === m
                  ? "border-gold bg-gold text-black"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Tooltip */}
      {hovered != null && (
        <div
          className="pointer-events-none absolute -top-10 z-10 flex items-center gap-1.5 whitespace-nowrap border border-border bg-card px-2 py-1 text-[11px] shadow-lg"
          style={{
            left: `${pct(hovered)}%`,
            transform: `translateX(${
              hovered < points.length / 4 ? "0" : hovered > (points.length * 3) / 4 ? "-100%" : "-50%"
            })`,
          }}
        >
          {points[hovered].opponentImage && (
            <img
              src={points[hovered].opponentImage!}
              alt=""
              className="h-[18px] w-[18px] rounded-full object-cover border border-border/40"
            />
          )}
          <span>
            {points[hovered].title === "won" && <span className="mr-1 font-bold text-gold">TITLE WON ·</span>}
            {points[hovered].title === "lost" && <span className="mr-1 font-bold text-muted-foreground">LOST FINAL ·</span>}
            {points[hovered].label}
            {points[hovered].rank ? <span className="ml-1.5 font-mono font-bold text-gold">#{points[hovered].rank}</span> : null}
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Rating trajectory over ${points.length} matches, currently ${last.rating}`}
      >
        {/* 1200 baseline reference */}
        {!showRank && <line
          x1={PAD}
          y1={baselineY}
          x2={W - PAD}
          y2={baselineY}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={1}
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />}
        {/* Crosshair */}
        {hovered != null && (
          <line
            x1={x(hovered)}
            y1={0}
            x2={x(hovered)}
            y2={height}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={path}
          fill="none"
          stroke="rgb(var(--accent-color))"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* High / low rating labels */}
      <span className="pointer-events-none absolute right-0 top-0 -translate-y-1/2 rounded bg-background/80 px-1 text-[9px] tabular-nums text-muted-foreground/60">
        {showRank ? `#${-max}` : max}
      </span>
      <span className="pointer-events-none absolute bottom-0 right-0 translate-y-1/2 rounded bg-background/80 px-1 text-[9px] tabular-nums text-muted-foreground/60">
        {showRank ? `#${-min}` : min}
      </span>

      {/* Win/loss dots as HTML overlays — true circles, unaffected by the
          SVG's horizontal stretch */}
      {points.map((p, i) => (
        <span
          key={i}
          className={`pointer-events-none absolute rounded-full ring-2 ring-background transition-[width,height] ${
            p.won ? "bg-emerald-500" : "bg-red-500"
          }`}
          style={{
            left: `${pct(i)}%`,
            top: y(value(p)),
            width: hovered === i ? 10 : 6,
            height: hovered === i ? 10 : 6,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {/* Championship finals: a gold diamond where a title was won, a hollow
          one where the final was lost */}
      {points.map((p, i) =>
        p.title ? (
          <span
            key={`t${i}`}
            aria-hidden
            className={`pointer-events-none absolute h-3 w-3 ring-2 ring-background ${
              p.title === "won" ? "bg-gold" : "border-2 border-gold bg-background"
            }`}
            style={{
              left: `${pct(i)}%`,
              top: y(value(p)) - 14,
              transform: "translate(-50%, -50%) rotate(45deg)",
            }}
          />
        ) : null
      )}
    </div>
  );
}
