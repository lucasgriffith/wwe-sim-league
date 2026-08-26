import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container max-w-screen-2xl px-4 py-16 animate-fade-in">
      <div className="mx-auto max-w-md rounded-xl border border-border/40 bg-card/50 p-8 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          404
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page doesn&apos;t exist or may have been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gold-dark"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
