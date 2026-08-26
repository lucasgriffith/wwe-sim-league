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

  if (points.length < 2) return null;

  const ratings = points.map((p) => p.rating);
  const min = Math.min(...ratings, 1200);
  const max = Math.max(...ratings, 1200);
  const span = Math.max(max - min, 20);

  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  // viewBox height maps 1:1 to CSS pixels, so y works for HTML overlays too
  const y = (r: number) => PAD + (1 - (r - min) / span) * (height - PAD * 2);
  const pct = (i: number) => (x(i) / W) * 100;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`)
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
      {/* Tooltip */}
      {hovered != null && (
        <div
          className="pointer-events-none absolute -top-10 z-10 flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border/60 bg-card px-2 py-1 text-[11px] shadow-lg"
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
          <span>{points[hovered].label}</span>
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
        <line
          x1={PAD}
          y1={baselineY}
          x2={W - PAD}
          y2={baselineY}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={1}
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />
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
            top: y(p.rating),
            width: hovered === i ? 10 : 6,
            height: hovered === i ? 10 : 6,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}
