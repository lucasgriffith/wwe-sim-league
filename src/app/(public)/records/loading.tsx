export default function RecordsLoading() {
  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <div className="mb-8">
        <div className="skeleton h-9 w-52" />
        <div className="skeleton mt-2 h-4 w-72" />
      </div>
      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-20 w-full" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-64 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
  );
}
