"use client";

interface Props {
  totalPlayed: number;
  totalMatches: number;
  firstMatchDate: string | null; // ISO string of earliest played_at
}

export function SeasonTimeline({ totalPlayed, totalMatches, firstMatchDate }: Props) {
  if (!firstMatchDate || totalPlayed < 2 || totalMatches === 0) return null;

  const remaining = totalMatches - totalPlayed;
  const pct = Math.round((totalPlayed / totalMatches) * 100);

  const firstDate = new Date(firstMatchDate);
  const now = new Date();
  const daysSinceFirst = Math.max(1, (now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  const avgPerDay = totalPlayed / daysSinceFirst;
  const daysToComplete = avgPerDay > 0 ? Math.ceil(remaining / avgPerDay) : null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/20 bg-card/30 px-4 py-2.5">
      {/* Progress bar */}
      <div className="h-2 flex-1 min-w-[80px] max-w-[200px] rounded-full bg-muted/20 overflow-hidden shrink-0">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background:
              pct === 100
                ? "rgb(16,185,129)"
                : "linear-gradient(90deg, rgb(212,175,55), rgb(245,158,11))",
          }}
        />
      </div>

      {/* Stats text */}
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
        <span className="font-bold tabular-nums text-foreground/80">{totalPlayed}</span>
        <span className="text-muted-foreground/50">/{totalMatches}</span>
        <span className="mx-1.5 text-muted-foreground/20">|</span>
        <span className="tabular-nums">{avgPerDay.toFixed(1)}/day</span>
        {daysToComplete !== null && remaining > 0 && (
          <>
            <span className="mx-1.5 text-muted-foreground/20">|</span>
            <span>
              Pool play done in{" "}
              <span className="font-semibold text-gold">{daysToComplete}d</span>
            </span>
          </>
        )}
        {remaining === 0 && (
          <>
            <span className="mx-1.5 text-muted-foreground/20">|</span>
            <span className="font-semibold text-emerald-400">Pool play complete</span>
          </>
        )}
      </span>
    </div>
  );
}
