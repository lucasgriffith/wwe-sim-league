/**
 * Per-championship colours. Every title gets its own plate colour, loosely
 * after the real belt's strap or brand, so a tier is recognisable at a
 * glance anywhere it appears. Keyed by tier slug; unknown tiers fall back
 * to league gold.
 */
export interface TierColor {
  /** Plate background */
  bg: string;
  /** Text colour that reads on the plate */
  fg: string;
}

const GOLD: TierColor = { bg: "#f2c14e", fg: "#0a0a0c" };
const CRIMSON: TierColor = { bg: "#c8102e", fg: "#ffffff" };
const SILVER: TierColor = { bg: "#c9ccd1", fg: "#0a0a0c" };
const WHITE: TierColor = { bg: "#f4f1ea", fg: "#0a0a0c" };
const BRONZE: TierColor = { bg: "#c17a3a", fg: "#0a0a0c" };
const BLUE: TierColor = { bg: "#2f6fdb", fg: "#ffffff" };
const BURGUNDY: TierColor = { bg: "#9b2242", fg: "#ffffff" };
const ORANGE: TierColor = { bg: "#e07a2b", fg: "#0a0a0c" };

const COLORS: Record<string, TierColor> = {
  // Men's singles
  "undisputed-wwe-championship": GOLD,
  "world-heavyweight-championship": CRIMSON,
  "wcw-world-heavyweight-championship": ORANGE,
  "ecw-world-heavyweight-championship": { bg: "#7b3fb5", fg: "#ffffff" },
  "nxt-championship": SILVER,
  "wwe-intercontinental-championship": WHITE,
  "wwe-crown-jewel-championship": { bg: "#0f8a5f", fg: "#ffffff" },
  "aaa-mega-championship": { bg: "#e84a8a", fg: "#0a0a0c" },
  "nxt-north-american-championship": BRONZE,
  "wwe-united-states-championship": BLUE,
  "million-dollar-championship": { bg: "#a8d93a", fg: "#0a0a0c" },
  "wwe-european-championship": { bg: "#7fb2ff", fg: "#0a0a0c" },
  "nxt-united-kingdom-championship": BURGUNDY,
  "ecw-world-television-championship": { bg: "#b98be8", fg: "#0a0a0c" },
  "nxt-cruiserweight-championship": { bg: "#19c3d1", fg: "#0a0a0c" },
  "wwe-hardcore-championship": { bg: "#8b8f97", fg: "#0a0a0c" },
  // Women's singles
  "wwe-women-s-championship": GOLD,
  "wwe-women-s-world-championship": CRIMSON,
  "nxt-women-s-championship": SILVER,
  "wwe-women-s-intercontinental-championship": WHITE,
  "nxt-women-s-north-american-championship": BRONZE,
  "wwe-women-s-united-states-championship": BLUE,
  "nxt-uk-women-s-championship": BURGUNDY,
  // Tag
  "wwe-world-tag-team-championship": GOLD,
  "nxt-tag-team-championship": SILVER,
  "wcw-tag-team-championship": ORANGE,
  "wwe-women-s-tag-team-championship": GOLD,
  "nxt-women-s-tag-team-championship": SILVER,
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function tierColor(slugOrName: string | null | undefined): TierColor {
  if (!slugOrName) return GOLD;
  return COLORS[slugOrName] ?? COLORS[slugify(slugOrName)] ?? GOLD;
}
