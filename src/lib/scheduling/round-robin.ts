export interface RoundRobinMatch {
  round: number;
  participantA: string;
  participantB: string;
}

/**
 * Generate a round-robin schedule using the circle method.
 * Given N participants, produces N-1 rounds with N/2 matches each.
 * Assumes N is even.
 */
export function generateRoundRobin(participants: string[]): RoundRobinMatch[] {
  const n = participants.length;
  if (n < 2) return [];

  // Copy to avoid mutating input
  const list = [...participants];

  // If odd, add a "bye" placeholder (shouldn't happen per spec, but safe)
  if (n % 2 !== 0) {
    list.push("__BYE__");
  }

  const size = list.length;
  const rounds = size - 1;
  const halfSize = size / 2;
  const matches: RoundRobinMatch[] = [];

  // Fix the first participant, rotate the rest
  const fixed = list[0];
  const rotating = list.slice(1);

  for (let round = 0; round < rounds; round++) {
    // First match: fixed vs rotating[0]
    const pairedWith = rotating[0];
    if (fixed !== "__BYE__" && pairedWith !== "__BYE__") {
      matches.push({
        round: round + 1,
        participantA: fixed,
        participantB: pairedWith,
      });
    }

    // Remaining matches: pair from outside in
    for (let i = 1; i < halfSize; i++) {
      const a = rotating[i];
      const b = rotating[rotating.length - i];
      if (a !== "__BYE__" && b !== "__BYE__" && a !== b) {
        matches.push({
          round: round + 1,
          participantA: a,
          participantB: b,
        });
      }
    }

    // Rotate: move last element to front
    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  return matches;
}

/**
 * Get all matches grouped by round.
 */
export function getMatchesByRound(
  matches: RoundRobinMatch[]
): Map<number, RoundRobinMatch[]> {
  const byRound = new Map<number, RoundRobinMatch[]>();
  for (const match of matches) {
    if (!byRound.has(match.round)) {
      byRound.set(match.round, []);
    }
    byRound.get(match.round)!.push(match);
  }
  return byRound;
}
