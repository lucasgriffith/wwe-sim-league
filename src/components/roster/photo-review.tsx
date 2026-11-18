"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { applyPhotoProposals } from "@/app/actions";
import { toast } from "sonner";
/* eslint-disable @next/next/no-img-element */

interface Proposal {
  id: string;
  name: string;
  proposed: string;
  previous: string | null;
  current: string | null;
}

export function PhotoReview({
  proposals,
  unmatched,
}: {
  proposals: Proposal[];
  unmatched: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"pending" | "applied" | "all">("pending");

  const isApplied = (p: Proposal) => p.current === p.proposed;
  const pending = proposals.filter((p) => !isApplied(p));
  const shown =
    filter === "all" ? proposals : filter === "applied" ? proposals.filter(isApplied) : pending;

  async function run(ids: string[], mode: "apply" | "revert") {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const { changed } = await applyPhotoProposals(ids, mode);
      toast.success(mode === "apply" ? `Updated ${changed} photo${changed === 1 ? "" : "s"}` : "Reverted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["pending", "applied", "all"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="text-xs capitalize"
          >
            {f} ({f === "all" ? proposals.length : f === "applied" ? proposals.length - pending.length : pending.length})
          </Button>
        ))}
        <Button
          size="sm"
          disabled={busy || pending.length === 0}
          onClick={() => run(pending.map((p) => p.id), "apply")}
          className="ml-auto bg-gold text-black hover:bg-gold-dark font-semibold text-xs"
        >
          Approve all {pending.length} pending
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {shown.map((p) => (
          <div key={p.id} className="rounded-lg border border-border/40 bg-card/40 p-3">
            <p className="truncate text-xs font-semibold" title={p.name}>{p.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <figure className="m-0">
                {(isApplied(p) ? p.previous : p.current) ? (
                  <img
                    src={(isApplied(p) ? p.previous : p.current)!}
                    alt={`Previous photo of ${p.name}`}
                    loading="lazy"
                    className="aspect-square w-full rounded-md bg-muted/20 object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted/20 text-[10px] text-muted-foreground/50">
                    none
                  </div>
                )}
                <figcaption className="mt-1 text-center text-[9px] uppercase tracking-wider text-muted-foreground/60">
                  {isApplied(p) ? "Before" : "Current"}
                </figcaption>
              </figure>
              <figure className="m-0">
                <img
                  src={p.proposed}
                  alt={`Proposed photo of ${p.name}`}
                  loading="lazy"
                  className="aspect-square w-full rounded-md bg-muted/20 object-cover ring-1 ring-gold/40"
                />
                <figcaption className="mt-1 text-center text-[9px] uppercase tracking-wider text-gold/80">
                  {isApplied(p) ? "Live" : "Proposed"}
                </figcaption>
              </figure>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => run([p.id], isApplied(p) ? "revert" : "apply")}
              className="mt-2 h-8 w-full text-xs"
            >
              {isApplied(p) ? "Revert" : "Approve"}
            </Button>
          </div>
        ))}
      </div>

      {unmatched.length > 0 && (
        <p className="mt-6 text-xs text-muted-foreground">
          No portrait found yet for {unmatched.length}: {unmatched.join(", ")}.
        </p>
      )}
    </div>
  );
}
