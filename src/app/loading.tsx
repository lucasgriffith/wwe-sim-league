export default function Loading() {
  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <div className="skeleton h-9 w-56" />
      <div className="mt-2 skeleton h-4 w-72" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
        <div className="skeleton h-40 hidden lg:block" />
      </div>
      <div className="mt-8 skeleton h-64" />
    </div>
  );
}
