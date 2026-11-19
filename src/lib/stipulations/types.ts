export const STIPULATIONS = [
  "Extreme Rules",
  "Inferno",
  "Three Stages of Hell",
  "I Quit",
  "Brawl",
  "Dumpster Match",
  "Ambulance Match",
  "Casket Match",
  "Steel Cage",
  "Hell in a Cell",
  "Table Match",
  "Ladder Match",
  "TLC",
  "Submission Match",
  "Falls Count Anywhere",
  "Iron Man",
  "Last Man Standing",
  "No Holds Barred",
] as const;

export type Stipulation = (typeof STIPULATIONS)[number];

export const HARDCORE_STIPULATION = "Falls Count Anywhere";
export const RELEGATION_STIPULATION = "Steel Cage";

/**
 * The Hardcore title is the one tier where the signature match is used for
 * EVERY match (pool play and all playoff rounds) rather than only the final.
 */
export function appliesToEveryMatch(fixedStipulation: string | null | undefined): boolean {
  return fixedStipulation === HARDCORE_STIPULATION;
}
