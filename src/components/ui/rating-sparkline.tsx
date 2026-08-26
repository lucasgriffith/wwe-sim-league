"use client";

import { useRef, useState } from "react";

/**
 * Rating trajectory — accent-colored line over a dashed 1200 baseline, a
 * win/loss dot at every match, and a crosshair + tooltip that follows the
 * pointer (mouse or touch).
 */

interface Point {
  rating: number;
  label: string; // tooltip text, e.g. "1234 — def. Mosh (S1)"
  won: boolean;
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
  const y = (r: number) => PAD + (1 - (r - min) / span) * (height - PAD * 2);

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

  // The SVG stretches to the container (preserveAspectRatio none), so convert
  // viewBox x back to a % for positioning the HTML tooltip/crosshair
  const pct = (i: number) => (x(i) / W) * 100;

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
          className="pointer-events-none absolute -top-9 z-10 whitespace-nowrap rounded-md border border-border/60 bg-card px-2 py-1 text-[11px] shadow-lg"
          style={{
            left: `${pct(hovered)}%`,
            transform: `translateX(${
              hovered < points.length / 4 ? "0" : hovered > (points.length * 3) / 4 ? "-100%" : "-50%"
            })`,
          }}
        >
          {points[hovered].label}
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
        {/* Win/loss dot at every match; hovered point enlarged */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.rating)}
            r={hovered === i ? 4 : 2.5}
            fill={p.won ? "#10b981" : "#ef4444"}
            stroke="var(--background, #000)"
            strokeWidth={hovered === i ? 1.5 : 0.75}
          />
        ))}
      </svg>
    </div>
  );
}
