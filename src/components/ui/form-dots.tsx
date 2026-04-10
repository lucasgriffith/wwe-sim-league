/**
 * FormDots -- shows last 5 match results as colored circles.
 *
 * Usage:
 *   <FormDots results={[true, false, true, true, false]} />
 *
 * true  = win  (green dot)
 * false = loss (red dot)
 *
 * Most recent result on the right. Shows up to 5 dots.
 */

import React from "react";

interface FormDotsProps {
  results: boolean[];
}

export function FormDots({ results }: FormDotsProps) {
  if (results.length === 0) return null;

  // Take last 5 results (results are already in chronological order)
  const last5 = results.slice(-5);

  return (
    <span
      className="inline-flex items-center gap-[3px]"
      aria-label={`Form: ${last5.map((r) => (r ? "W" : "L")).join("")}`}
    >
      {last5.map((won, i) => (
        <span
          key={i}
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            won ? "bg-emerald-400" : "bg-red-400"
          }`}
        />
      ))}
    </span>
  );
}
