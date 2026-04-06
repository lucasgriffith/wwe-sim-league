"use client";

import React from "react";

interface ChampionBadgeProps {
  beltName: string;
  beltImageUrl?: string | null;
}

export function ChampionBadge({ beltName, beltImageUrl }: ChampionBadgeProps) {
  return (
    <span
      className="inline-flex items-center shrink-0"
      title={`${beltName} Champion`}
    >
      {beltImageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={beltImageUrl}
          alt={`${beltName} belt`}
          className="h-3.5 w-auto object-contain"
        />
      ) : (
        <span className="text-sm leading-none" role="img" aria-label={`${beltName} Champion`}>
          🏆
        </span>
      )}
    </span>
  );
}
