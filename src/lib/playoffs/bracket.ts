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
 * Generate a single-elimination bracket sized to the qualifier count:
 *
 * 6+: QF1 3v6, QF2 4v5, SF1 1 vs QF2 winner, SF2 2 vs QF1 winner, Final
 * 5:  QF1 4v5, SF1 1 vs QF1 winner, SF2 2v3, Final
 * 4:  SF1 1v4, SF2 2v3, Final
 * 2-3: Final between the top 2 (tag tiers and tiny fields)
 */
export function generateBracket(seeds: PlayoffSeed[]): BracketMatch[] {
  if (seeds.length < 4) {
    return [
      {
        matchKey: "Final",
        round: "final",
        seedA: seeds[0] ?? null,
        seedB: seeds[1] ?? null,
      },
    ];
  }

  const finalMatch: BracketMatch = {
    matchKey: "Final",
    round: "final",
    seedA: null, // Winner of SF1
    seedB: null, // Winner of SF2
    sourceMatchA: "SF1",
    sourceMatchB: "SF2",
  };

  if (seeds.length === 4) {
    return [
      { matchKey: "SF1", round: "semifinal", seedA: seeds[0], seedB: seeds[3] },
      { matchKey: "SF2", round: "semifinal", seedA: seeds[1], seedB: seeds[2] },
      finalMatch,
    ];
  }

  if (seeds.length === 5) {
    return [
      { matchKey: "QF1", round: "quarterfinal", seedA: seeds[3], seedB: seeds[4] },
      {
        matchKey: "SF1",
        round: "semifinal",
        seedA: seeds[0],
        seedB: null, // Winner of QF1
        sourceMatchB: "QF1",
      },
      { matchKey: "SF2", round: "semifinal", seedA: seeds[1], seedB: seeds[2] },
      finalMatch,
    ];
  }

  return [
    { matchKey: "QF1", round: "quarterfinal", seedA: seeds[2], seedB: seeds[5] },
    { matchKey: "QF2", round: "quarterfinal", seedA: seeds[3], seedB: seeds[4] },
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
    finalMatch,
  ];
}

/**
 * Invert a bracket's source links into "where does each match's winner go":
 * e.g. { QF2: "SF1:B", SF1: "Final:A" }. Stored on each match row as
 * `advances_to` so recording a result can push the winner forward.
 */
export function computeAdvancesMap(
  bracket: BracketMatch[]
): Record<string, string> {
  const advances: Record<string, string> = {};
  for (const target of bracket) {
    if (target.sourceMatchA) advances[target.sourceMatchA] = `${target.matchKey}:A`;
    if (target.sourceMatchB) advances[target.sourceMatchB] = `${target.matchKey}:B`;
  }
  return advances;
}
