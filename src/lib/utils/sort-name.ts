/**
 * Generate a sort key from a wrestler name that ignores leading quotes/nicknames.
 * e.g. '"Ravishing" Rick Rude' → 'rick rude'
 *      '"Mr. Wonderful" Paul Orndorff' → 'paul orndorff'
 *      'John Cena' → 'john cena'
 */
export function sortName(name: string): string {
  // Remove leading quoted nickname: "Nickname" or 'Nickname'
  return name
    .replace(/^["'\u201C\u201D\u2018\u2019][^"'\u201C\u201D\u2018\u2019]*["'\u201C\u201D\u2018\u2019]\s*/g, "")
    .toLowerCase();
}

/**
 * Sort an array of objects with a `name` property, ignoring leading quoted nicknames.
 */
export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => sortName(a.name).localeCompare(sortName(b.name)));
}
