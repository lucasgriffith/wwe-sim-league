export default function Loading() {
  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      {/* Back link */}
      <div className="skeleton h-4 w-28" />

      {/* Header: avatar + name */}
      <div className="mt-6 mb-8 flex items-start gap-5">
        <div className="h-20 w-20 animate-pulse rounded-xl border-2 border-border/20 bg-muted/20" />
        <div>
          <div className="skeleton h-9 w-64" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="h-5 w-14 animate-pulse rounded-full bg-muted/40" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted/40" />
            <div className="skeleton h-4 w-16" />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>

      {/* Match history table */}
      <div className="mt-8 rounded-lg border border-border/40 overflow-hidden">
        <div className="border-b border-border/30 bg-card/50 px-4 py-2.5">
          <div className="skeleton h-4 w-36" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton h-8" />
          ))}
        </div>
      </div>
    </div>
  );
}
