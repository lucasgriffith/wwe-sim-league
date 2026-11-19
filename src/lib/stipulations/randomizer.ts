import { RELEGATION_STIPULATION, STIPULATIONS } from "./types";

/**
 * Stipulation for one playoff match.
 * - The championship final is fought under the tier's signature match.
 * - Earlier rounds draw at random, never repeating within the bracket and
 *   never using the tier's signature match (kept for the final) or Steel
 *   Cage (kept for promotion and relegation matches).
 * - A tier with no signature match draws its final at random too.
 */
export function assignStipulation(
  fixedStipulation: string | null,
  usedInBracket: string[],
  round: string = "final"
): string {
  if (fixedStipulation && round === "final") return fixedStipulation;

  const drawable = STIPULATIONS.filter(
    (s) => s !== RELEGATION_STIPULATION && s !== fixedStipulation
  );
  const available = drawable.filter((s) => !usedInBracket.includes(s));
  const from = available.length > 0 ? available : drawable;
  return from[Math.floor(Math.random() * from.length)];
}
