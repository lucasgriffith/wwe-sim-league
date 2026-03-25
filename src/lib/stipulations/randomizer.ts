import { STIPULATIONS, HARDCORE_STIPULATION } from "./types";

/**
 * Assign a random stipulation for a playoff match.
 * - If the tier is Hardcore, always returns Falls Count Anywhere.
 * - Otherwise, picks from the 18 types, avoiding any already used in this bracket.
 */
export function assignStipulation(
  fixedStipulation: string | null,
  usedInBracket: string[]
): string {
  // Tier with a fixed stipulation (e.g. Hardcore)
  if (fixedStipulation) {
    return fixedStipulation;
  }

  // Filter out already-used stipulations
  const available = STIPULATIONS.filter((s) => !usedInBracket.includes(s));

  if (available.length === 0) {
    // All 18 used — allow repeats (shouldn't happen with 5 matches max)
    return STIPULATIONS[Math.floor(Math.random() * STIPULATIONS.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Assign stipulations for all playoff matches in a tier's bracket at once.
 * Returns an array of stipulations in the same order as the match keys provided.
 */
export function assignBracketStipulations(
  matchCount: number,
  fixedStipulation: string | null
): string[] {
  if (fixedStipulation) {
    return Array(matchCount).fill(fixedStipulation);
  }

  const assigned: string[] = [];
  for (let i = 0; i < matchCount; i++) {
    assigned.push(assignStipulation(null, assigned));
  }
  return assigned;
}
