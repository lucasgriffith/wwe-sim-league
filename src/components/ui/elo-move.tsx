export interface EloMoveData {
  delta: number;
  rating: number;
  /** Null when this was their first match, so they had no rank before it */
  rankBefore: number | null;
  rankAfter: number;
}

/** Rating change, plus the pool rank before and after when the match moved it */
export function EloMoveChip({ move, className = "" }: { move: EloMoveData | null; className?: string }) {
  if (!move) return null;
  const up = move.delta >= 0;
  const moved = move.rankBefore !== null && move.rankBefore !== move.rankAfter;
  const climbed = moved && move.rankAfter < move.rankBefore!;
  return (
    <span className={`inline-flex items-baseline gap-1.5 whitespace-nowrap font-mono text-[11px] tabular-nums ${className}`}>
      <span className={up ? "text-emerald-400" : "text-red-400"} title={`Elo ${move.rating}`}>
        {up ? "+" : "−"}
        {Math.abs(move.delta)}
      </span>
      {moved && (
        <span
          className={climbed ? "text-emerald-400/80" : "text-red-400/80"}
          title={`Elo rank ${move.rankBefore} to ${move.rankAfter}`}
        >
          {climbed ? "▲" : "▼"}#{move.rankBefore}
          <span className="text-muted-foreground/60">{"→"}</span>#{move.rankAfter}
        </span>
      )}
      {move.rankBefore === null && (
        <span className="text-muted-foreground" title="First match: enters the rankings">
          new #{move.rankAfter}
        </span>
      )}
    </span>
  );
}
