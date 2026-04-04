"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { undoMatchResult } from "@/app/actions";
import { toast } from "sonner";

export function UndoMatchButton({ matchId, winnerName }: { matchId: string; winnerName: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleUndo() {
    if (!window.confirm(`Undo ${winnerName}'s win? This will reset the match to unplayed.`)) return;
    startTransition(async () => {
      try {
        await undoMatchResult(matchId);
        toast.success("Match result undone");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to undo");
      }
    });
  }

  return (
    <button
      onClick={handleUndo}
      disabled={isPending}
      className="text-[9px] text-muted-foreground/30 hover:text-red-400 transition-colors shrink-0 disabled:opacity-50"
      title="Undo this result"
    >
      {isPending ? "..." : "↩"}
    </button>
  );
}
