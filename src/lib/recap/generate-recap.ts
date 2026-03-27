/**
 * Generate a narrative season recap from season data.
 */

interface RecapData {
  seasonNumber: number;
  champions: Array<{
    tierName: string;
    tierNumber: number;
    divisionName: string;
    winnerName: string;
    runnerUpName: string;
    finalStipulation: string | null;
    finalTime: number | null;
  }>;
  mvp: {
    name: string;
    wins: number;
    losses: number;
    winPct: number;
    tierName: string;
  } | null;
  records: {
    fastestMatch: { time: number; winnerName: string; loserName: string; tierName: string } | null;
    longestMatch: { time: number; winnerName: string; loserName: string; tierName: string } | null;
    bestRecord: { name: string; wins: number; losses: number; winPct: number } | null;
    mostMatches: { name: string; count: number } | null;
  };
  totalMatches: number;
  biggestMovers: Array<{
    name: string;
    fromTier: number;
    toTier: number;
    direction: "up" | "down";
    change: number;
  }>;
}

export function generateRecapSections(data: RecapData): Array<{
  title: string;
  content: string;
  emoji: string;
}> {
  const sections: Array<{ title: string; content: string; emoji: string }> = [];

  // Overview
  sections.push({
    title: "Season Overview",
    emoji: "📊",
    content: `Season ${data.seasonNumber} featured ${data.totalMatches} matches across ${data.champions.length} championship tiers.`,
  });

  // Champions
  if (data.champions.length > 0) {
    const topChampion = data.champions.find((c) => c.tierNumber === 1);
    let champContent = "";

    if (topChampion) {
      champContent += `${topChampion.winnerName} claimed the prestigious ${topChampion.tierName}`;
      if (topChampion.finalStipulation) {
        champContent += ` in a ${topChampion.finalStipulation} match`;
      }
      champContent += ` over ${topChampion.runnerUpName}.`;
    }

    if (data.champions.length > 1) {
      champContent += ` ${data.champions.length} championships were decided in total.`;
    }

    sections.push({
      title: "Champions Crowned",
      emoji: "🏆",
      content: champContent,
    });
  }

  // MVP
  if (data.mvp) {
    sections.push({
      title: "Season MVP",
      emoji: "⭐",
      content: `${data.mvp.name} dominated with a ${data.mvp.wins}-${data.mvp.losses} record (${(data.mvp.winPct * 100).toFixed(0)}% win rate) in the ${data.mvp.tierName}.`,
    });
  }

  // Records
  if (data.records.fastestMatch) {
    const time = data.records.fastestMatch.time;
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    sections.push({
      title: "Fastest Match",
      emoji: "⚡",
      content: `${data.records.fastestMatch.winnerName} defeated ${data.records.fastestMatch.loserName} in just ${mins}:${secs.toString().padStart(2, "0")} (${data.records.fastestMatch.tierName}).`,
    });
  }

  if (data.records.longestMatch) {
    const time = data.records.longestMatch.time;
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    sections.push({
      title: "Longest Match",
      emoji: "⏱️",
      content: `${data.records.longestMatch.winnerName} outlasted ${data.records.longestMatch.loserName} in an epic ${mins}:${secs.toString().padStart(2, "0")} bout (${data.records.longestMatch.tierName}).`,
    });
  }

  // Biggest Movers
  if (data.biggestMovers.length > 0) {
    const risers = data.biggestMovers.filter((m) => m.direction === "up").slice(0, 3);
    const fallers = data.biggestMovers.filter((m) => m.direction === "down").slice(0, 3);

    if (risers.length > 0) {
      const riserText = risers
        .map((r) => `${r.name} (T${r.fromTier} → T${r.toTier}, ↑${r.change})`)
        .join(", ");
      sections.push({
        title: "Rising Stars",
        emoji: "📈",
        content: riserText,
      });
    }

    if (fallers.length > 0) {
      const fallerText = fallers
        .map((f) => `${f.name} (T${f.fromTier} → T${f.toTier}, ↓${f.change})`)
        .join(", ");
      sections.push({
        title: "Biggest Falls",
        emoji: "📉",
        content: fallerText,
      });
    }
  }

  return sections;
}
