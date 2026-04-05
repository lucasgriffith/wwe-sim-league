/**
 * Sparkline – tiny inline SVG showing win/loss trajectory.
 *
 * Usage:
 *   <Sparkline results={[true, false, true, true, false]} />
 *
 * true  = win  (dot goes up)
 * false = loss (dot goes down)
 *
 * Line color: green when the last result is a win, red when it is a loss.
 * Size: w-10 h-4 inline (40 x 16 px).
 */

import React from "react";

interface SparklineProps {
  results: boolean[];
}

export function Sparkline({ results }: SparklineProps) {
  if (results.length === 0) return null;

  const width = 40;
  const height = 16;
  const padding = 2;

  // Y positions: win = top, loss = bottom (with padding)
  const yWin = padding;
  const yLoss = height - padding;

  const points = results.map((won, i) => {
    const x =
      results.length === 1
        ? width / 2
        : padding + (i / (results.length - 1)) * (width - padding * 2);
    const y = won ? yWin : yLoss;
    return { x, y };
  });

  // Build polyline path
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  // Color based on last result
  const lastWin = results[results.length - 1];
  const color = lastWin ? "#10b981" : "#ef4444"; // emerald-500 / red-500

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block w-10 h-4"
      aria-label={`Trend: ${results.map((r) => (r ? "W" : "L")).join("")}`}
    >
      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.5} fill={color} />
      ))}
    </svg>
  );
}
