export default function Loading() {
  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      {/* Heading + status badge */}
      <div className="mb-8 flex items-center gap-4">
        <div className="skeleton h-9 w-52" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-muted/40" />
      </div>

      {/* Status stepper strip */}
      <div className="mb-10 flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-1 items-center gap-1">
            <div className="h-7 w-7 animate-pulse rounded-full bg-muted/40" />
            {i < 4 && <div className="h-px flex-1 bg-border/40" />}
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Tier progress cards */}
        <div>
          <div className="mb-3 skeleton h-3 w-28" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        </div>

        {/* Upcoming matches column */}
        <div>
          <div className="mb-3 skeleton h-3 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
