export default function Loading() {
  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <div className="mb-6">
        <div className="skeleton h-9 w-36" />
        <div className="mt-2 skeleton h-4 w-28" />
      </div>

      {/* Search bar + filter strip */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="skeleton h-9 w-full max-w-xs" />
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-16 animate-pulse rounded-lg bg-muted/40"
            />
          ))}
        </div>
      </div>

      {/* Roster table */}
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="border-b border-border/30 bg-card/50 px-4 py-2.5">
          <div className="skeleton h-4 w-40" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton h-8" />
          ))}
        </div>
      </div>
    </div>
  );
}
