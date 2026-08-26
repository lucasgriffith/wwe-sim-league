export default function Loading() {
  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <div className="mb-8">
        <div className="skeleton h-9 w-56" />
        <div className="mt-2 skeleton h-4 w-40" />
      </div>

      {/* Season cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border/40 bg-card/50 px-6 py-4"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted/40" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded-md bg-muted/40" />
                <div className="h-3 w-48 rounded-md bg-muted/30" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-5 w-24 rounded-full bg-muted/30" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
