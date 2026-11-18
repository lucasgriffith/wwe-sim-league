/**
 * Score-bug style ranking: the small number that sits in front of a ranked
 * team's name on a college football broadcast. Shown for the top 25 of a
 * pool by default — like the polls, being ranked means something.
 */
export function RankBadge({
  rank,
  max = 25,
  className = "",
}: {
  rank: number | null | undefined;
  max?: number;
  className?: string;
}) {
  if (!rank || rank > max) return null;
  return (
    <span
      className={`mr-1 align-[0.08em] text-[0.72em] font-bold tabular-nums text-gold/80 ${className}`}
      title={`Ranked #${rank} by Elo`}
    >
      {rank}
    </span>
  );
}
