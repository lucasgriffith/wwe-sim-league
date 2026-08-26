"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container max-w-screen-2xl px-4 py-16 animate-fade-in">
      <div className="mx-auto max-w-md rounded-xl border border-border/40 bg-card/50 p-8 text-center">
        <h2 className="text-xl font-bold tracking-tight">
          Something went wrong
        </h2>
        <p className="mt-2 break-words text-xs text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground/50">
            Ref: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => (unstable_retry ?? reset)()}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gold-dark"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
