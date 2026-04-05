"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function LiveFeed() {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("match-results")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
        },
        async (payload) => {
          const oldRow = payload.old as Record<string, unknown>;
          const newRow = payload.new as Record<string, unknown>;

          // Only fire when played_at transitions from null to a value
          if (oldRow.played_at || !newRow.played_at) return;

          const winnerId =
            (newRow.winner_wrestler_id as string) ??
            (newRow.winner_tag_team_id as string);

          if (!winnerId) return;

          // Fetch the winner's name
          const isTag = !!newRow.winner_tag_team_id;
          let winnerName = "Unknown";

          if (isTag) {
            const { data } = await supabase
              .from("tag_teams")
              .select("name")
              .eq("id", winnerId)
              .single();
            winnerName = data?.name ?? "Unknown";
          } else {
            const { data } = await supabase
              .from("wrestlers")
              .select("name")
              .eq("id", winnerId)
              .single();
            winnerName = data?.name ?? "Unknown";
          }

          toast.success(`${winnerName} wins!`, {
            description: "A new match result was just recorded.",
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
