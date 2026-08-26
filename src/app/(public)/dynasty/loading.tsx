export default function Loading() {
  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <div className="mb-8">
        <div className="skeleton h-9 w-72" />
        <div className="mt-2 skeleton h-4 w-56" />
      </div>

      {/* Tab row */}
      <div className="mb-4 flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-28 animate-pulse rounded-lg bg-muted/40"
          />
        ))}
      </div>

      {/* Leaderboard table */}
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="border-b border-border/30 bg-card/50 px-4 py-2.5">
          <div className="skeleton h-4 w-48" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton h-8" />
          ))}
        </div>
      </div>
    </div>
  );
}
