export default function RankingsLoading() {
  return (
    <div className="container max-w-screen-2xl px-4 py-8">
      <div className="skeleton h-9 w-52" />
      <div className="skeleton mt-2 h-4 w-96 max-w-full" />
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="skeleton h-[32rem] w-full" />
        <div className="skeleton h-[32rem] w-full" />
      </div>
    </div>
  );
}
