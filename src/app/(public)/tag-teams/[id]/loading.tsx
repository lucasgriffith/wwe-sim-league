export default function TagTeamProfileLoading() {
  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <div className="skeleton h-4 w-32" />
      <div className="mt-6 mb-8 flex items-center gap-5">
        <div className="flex -space-x-5">
          <div className="skeleton h-20 w-20 rounded-xl" />
          <div className="skeleton h-20 w-20 rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="skeleton h-8 w-56" />
          <div className="skeleton h-4 w-72" />
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-full" />
        ))}
      </div>
      <div className="skeleton mt-3 h-24 w-full" />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-52 w-full" />
        <div className="skeleton h-52 w-full" />
      </div>
    </div>
  );
}
