function TableBlock() {
  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <div className="border-b border-border/30 bg-card/50 px-4 py-2.5">
        <div className="skeleton h-4 w-44" />
      </div>
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-8" />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <div className="mb-6">
        <div className="skeleton h-9 w-44" />
        <div className="mt-2 skeleton h-4 w-40" />
      </div>

      {/* Division pill row */}
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-32 animate-pulse rounded-full bg-muted/40"
          />
        ))}
      </div>

      <div className="space-y-6">
        <TableBlock />
        <TableBlock />
        <TableBlock />
      </div>
    </div>
  );
}
