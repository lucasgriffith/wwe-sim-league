"use client";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  totalPlayed: number;
  totalMatches: number;
  tiersStarted: number;
  totalTiers: number;
  fastestMatch: number | null;
  fastestMatchName: string | null;
  averageMatchTime: number | null;
  seasonNumber: number;
}

export function SeasonTicker({
  totalPlayed,
  totalMatches,
  tiersStarted,
  totalTiers,
  fastestMatch,
  fastestMatchName,
  averageMatchTime,
  seasonNumber,
}: Props) {
  const items = [
    `Season ${seasonNumber} Pool Play`,
    `${totalPlayed} / ${totalMatches} matches played`,
    `${tiersStarted} / ${totalTiers} tiers in progress`,
    fastestMatch
      ? `⚡ Fastest: ${formatTime(fastestMatch)}${fastestMatchName ? ` (${fastestMatchName})` : ""}`
      : null,
    averageMatchTime ? `Avg match: ${formatTime(averageMatchTime)}` : null,
    `${totalMatches - totalPlayed} matches remaining`,
  ].filter(Boolean) as string[];

  if (totalPlayed === 0) return null;

  return (
    <div className="w-full overflow-hidden border-b border-border/10 bg-gradient-to-r from-gold/[0.02] via-transparent to-gold/[0.02]">
      <div className="animate-ticker flex whitespace-nowrap py-1.5">
        {[...items, ...items].map((item, i) => (
          <span
            key={i}
            className="mx-6 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 inline-flex items-center gap-1.5"
          >
            <span className="h-1 w-1 rounded-full bg-gold/30" />
            {item}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
