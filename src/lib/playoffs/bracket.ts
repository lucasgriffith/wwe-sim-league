import type { PlayoffSeed } from "./seeding";

export interface BracketMatch {
  matchKey: string; // e.g. "QF1", "QF2", "SF1", "SF2", "Final"
  round: "quarterfinal" | "semifinal" | "final";
  seedA: PlayoffSeed | null; // null = TBD (winner of prior match)
  seedB: PlayoffSeed | null;
  sourceMatchA?: string; // e.g. "QF1" — which match feeds into this slot
  sourceMatchB?: string;
}

/**
 * Generate a 6-person single-elimination bracket:
 *
 * QF1: Seed 3 vs Seed 6
 * QF2: Seed 4 vs Seed 5
 * SF1: Seed 1 (bye) vs Winner of QF2
 * SF2: Seed 2 (bye) vs Winner of QF1
 * Final: Winner of SF1 vs Winner of SF2
 */
export function generateBracket(seeds: PlayoffSeed[]): BracketMatch[] {
  if (seeds.length < 6) {
    // Tag tier: just a final between top 2
    return [
      {
        matchKey: "Final",
        round: "final",
        seedA: seeds[0] ?? null,
        seedB: seeds[1] ?? null,
      },
    ];
  }

  return [
    {
      matchKey: "QF1",
      round: "quarterfinal",
      seedA: seeds[2], // Seed 3
      seedB: seeds[5], // Seed 6
    },
    {
      matchKey: "QF2",
      round: "quarterfinal",
      seedA: seeds[3], // Seed 4
      seedB: seeds[4], // Seed 5
    },
    {
      matchKey: "SF1",
      round: "semifinal",
      seedA: seeds[0], // Seed 1 (bye)
      seedB: null, // Winner of QF2
      sourceMatchB: "QF2",
    },
    {
      matchKey: "SF2",
      round: "semifinal",
      seedA: seeds[1], // Seed 2 (bye)
      seedB: null, // Winner of QF1
      sourceMatchB: "QF1",
    },
    {
      matchKey: "Final",
      round: "final",
      seedA: null, // Winner of SF1
      seedB: null, // Winner of SF2
      sourceMatchA: "SF1",
      sourceMatchB: "SF2",
    },
  ];
}
