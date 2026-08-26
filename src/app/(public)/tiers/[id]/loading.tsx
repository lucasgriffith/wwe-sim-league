function TableBlock() {
  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <div className="border-b border-border/20 bg-muted/5 px-3 py-2">
        <div className="skeleton h-3 w-56" />
      </div>
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-8" />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      {/* Hero */}
      <div className="mb-8 rounded-xl border border-border/40 p-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="skeleton h-3 w-12" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted/40" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted/40" />
        </div>
        <div className="flex items-center gap-4">
          <div className="skeleton h-9 w-64" />
          <div className="skeleton h-24 w-44 shrink-0" />
        </div>
      </div>

      {/* Pool header strip */}
      <div className="mb-3 skeleton h-10" />

      {/* Standings tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TableBlock />
        <TableBlock />
      </div>
    </div>
  );
}
