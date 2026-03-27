"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordMatchResult } from "@/app/actions";
import { toast } from "sonner";

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

interface BulkRow {
  matchId: string;
  winner: string;
  minutes: string;
  seconds: string;
}

export function BulkMatchEntry({
  tiers,
  matches,
  wrestlerMap,
  tagTeamMap,
}: {
  tiers: Tier[];
  matches: Match[];
  wrestlerMap: Record<string, string>;
  tagTeamMap: Record<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTier, setSelectedTier] = useState("");
  const [rows, setRows] = useState<Record<string, BulkRow>>({});

  const tierMatches = matches.filter((m) => m.tier_id === selectedTier);
  const tiersWithMatches = tiers.filter((t) =>
    matches.some((m) => m.tier_id === t.id)
  );

  function updateRow(matchId: string, field: keyof BulkRow, value: string) {
    setRows((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        matchId,
        [field]: value,
      },
    }));
  }

  const filledRows = tierMatches.filter((m) => {
    const row = rows[m.id];
    if (!row) return false;
    const time = (parseInt(row.minutes) || 0) * 60 + (parseInt(row.seconds) || 0);
    return row.winner && time > 0;
  });

  async function handleSubmitAll() {
    startTransition(async () => {
      let success = 0;
      let failed = 0;

      for (const m of filledRows) {
        const row = rows[m.id];
        const timeSeconds = (parseInt(row.minutes) || 0) * 60 + (parseInt(row.seconds) || 0);
        const isTag = !!m.tag_team_a_id;

        try {
          await recordMatchResult(m.id, {
            ...(isTag
              ? { winner_tag_team_id: row.winner }
              : { winner_wrestler_id: row.winner }),
            match_time_seconds: timeSeconds,
          });
          success++;
        } catch {
          failed++;
        }
      }

      if (success > 0) toast.success(`${success} match${success > 1 ? "es" : ""} recorded`);
      if (failed > 0) toast.error(`${failed} failed`);

      setRows({});
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Select value={selectedTier} onValueChange={(v) => setSelectedTier(v ?? "")}>
        <SelectTrigger className="h-12 text-sm">
          <SelectValue placeholder="Select tier for bulk entry..." />
        </SelectTrigger>
        <SelectContent>
          {tiersWithMatches.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <span className="font-mono text-xs text-muted-foreground mr-2">T{t.tier_number}</span>
              {t.short_name || t.name}
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {matches.filter((m) => m.tier_id === t.id).length} left
              </Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {tierMatches.length > 0 && (
        <>
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 border-b border-border/30">
                  <th className="px-3 py-2 text-left">Match</th>
                  <th className="px-3 py-2 text-left">Winner</th>
                  <th className="px-3 py-2 text-center w-28">Time</th>
                </tr>
              </thead>
              <tbody>
                {tierMatches.map((m) => {
                  const isTag = !!m.tag_team_a_id;
                  const nameA = isTag
                    ? tagTeamMap[m.tag_team_a_id ?? ""] ?? "?"
                    : wrestlerMap[m.wrestler_a_id ?? ""] ?? "?";
                  const nameB = isTag
                    ? tagTeamMap[m.tag_team_b_id ?? ""] ?? "?"
                    : wrestlerMap[m.wrestler_b_id ?? ""] ?? "?";
                  const idA = isTag ? m.tag_team_a_id! : m.wrestler_a_id!;
                  const idB = isTag ? m.tag_team_b_id! : m.wrestler_b_id!;
                  const row = rows[m.id];
                  const isFilled = row?.winner && ((parseInt(row.minutes) || 0) * 60 + (parseInt(row.seconds) || 0)) > 0;

                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-border/20 ${isFilled ? "bg-emerald-500/5" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <div className="text-xs">
                          <span className="font-medium">{nameA}</span>
                          <span className="text-muted-foreground/40 mx-1">vs</span>
                          <span className="font-medium">{nameB}</span>
                        </div>
                        <div className="flex gap-1 mt-0.5">
                          {m.pool && (
                            <span className="text-[9px] text-muted-foreground/50">Pool {m.pool}</span>
                          )}
                          <span className="text-[9px] text-muted-foreground/50">Rd {m.round_number}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={row?.winner ?? ""}
                          onValueChange={(v) => updateRow(m.id, "winner", v ?? "")}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Winner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={idA}>{nameA}</SelectItem>
                            <SelectItem value={idB}>{nameB}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-center">
                          <Input
                            type="number"
                            min={0}
                            max={99}
                            placeholder="M"
                            value={row?.minutes ?? ""}
                            onChange={(e) => updateRow(m.id, "minutes", e.target.value)}
                            className="w-12 h-8 text-center text-xs tabular-nums"
                          />
                          <span className="text-xs text-muted-foreground/40">:</span>
                          <Input
                            type="number"
                            min={0}
                            max={59}
                            placeholder="S"
                            value={row?.seconds ?? ""}
                            onChange={(e) => updateRow(m.id, "seconds", e.target.value)}
                            className="w-12 h-8 text-center text-xs tabular-nums"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filledRows.length} / {tierMatches.length} matches ready
            </span>
            <Button
              onClick={handleSubmitAll}
              disabled={isPending || filledRows.length === 0}
              className="bg-gold text-black hover:bg-gold-dark font-semibold"
            >
              {isPending
                ? "Submitting..."
                : `Submit ${filledRows.length} Match${filledRows.length !== 1 ? "es" : ""}`}
            </Button>
          </div>
        </>
      )}

      {selectedTier && tierMatches.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          All matches in this tier have been played
        </div>
      )}
    </div>
  );
}
