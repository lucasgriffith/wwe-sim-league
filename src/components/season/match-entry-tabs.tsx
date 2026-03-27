"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MatchEntry } from "./match-entry";
import { BulkMatchEntry } from "./bulk-match-entry";

interface Match {
  id: string;
  tier_id: string;
  round_number: number | null;
  match_phase: string;
  pool: string | null;
  wrestler_a_id: string | null;
  wrestler_b_id: string | null;
  tag_team_a_id: string | null;
  tag_team_b_id: string | null;
  stipulation: string | null;
}

interface Tier {
  id: string;
  tier_number: number;
  name: string;
  short_name: string | null;
  divisions: { name: string; division_type: string } | null;
}

export function MatchEntryTabs({
  seasonId,
  tiers,
  matches,
  wrestlerMap,
  tagTeamMap,
  playedCount,
  totalCount,
}: {
  seasonId: string;
  tiers: Tier[];
  matches: Match[];
  wrestlerMap: Record<string, string>;
  tagTeamMap: Record<string, string>;
  playedCount: number;
  totalCount: number;
}) {
  const [mode, setMode] = useState<"single" | "bulk">("single");

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        <Button
          variant={mode === "single" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("single")}
          className={`text-xs ${mode !== "single" ? "border-border/40 text-muted-foreground" : ""}`}
        >
          Single Entry
        </Button>
        <Button
          variant={mode === "bulk" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("bulk")}
          className={`text-xs ${mode !== "bulk" ? "border-border/40 text-muted-foreground" : ""}`}
        >
          Bulk Entry
        </Button>
      </div>

      {mode === "single" ? (
        <MatchEntry
          seasonId={seasonId}
          tiers={tiers}
          matches={matches}
          wrestlerMap={wrestlerMap}
          tagTeamMap={tagTeamMap}
          playedCount={playedCount}
          totalCount={totalCount}
        />
      ) : (
        <BulkMatchEntry
          tiers={tiers}
          matches={matches}
          wrestlerMap={wrestlerMap}
          tagTeamMap={tagTeamMap}
        />
      )}
    </div>
  );
}
