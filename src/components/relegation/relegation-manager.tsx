"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { advanceSeasonStatus, recordMatchResult, bulkCreateRelegationEvents } from "@/app/actions";
import { toast } from "sonner";

interface Props {
  season: { id: string; season_number: number; status: string };
  tiers: Array<{
    id: string;
    tier_number: number;
    name: string;
    short_name: string | null;
    divisions: { name: string; gender: string; division_type: string } | null;
  }>;
  matches: Array<{
    id: string;
    tier_id: string;
    match_phase: string;
    wrestler_a_id: string | null;
    wrestler_b_id: string | null;
    tag_team_a_id: string | null;
    tag_team_b_id: string | null;
    winner_wrestler_id: string | null;
    winner_tag_team_id: string | null;
    match_time_seconds: number | null;
    stipulation: string | null;
    played_at: string | null;
  }>;
  assignments: Array<{
    tier_id: string;
    wrestler_id: string | null;
    tag_team_id: string | null;
    pool: string | null;
  }>;
  relegationEvents: Array<{
    id: string;
    wrestler_id: string | null;
    tag_team_id: string | null;
    movement_type: string;
    from_tier_id: string | null;
    to_tier_id: string | null;
  }>;
  wrestlers: Array<{ id: string; name: string }>;
  tagTeams: Array<{ id: string; name: string }>;
}

export function RelegationManager({
  season,
  tiers,
  matches,
  assignments,
  relegationEvents,
  wrestlers,
  tagTeams,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");

  const wrestlerMap = Object.fromEntries(wrestlers.map((w) => [w.id, w.name]));
  const tagTeamMap = Object.fromEntries(tagTeams.map((t) => [t.id, t.name]));
  const tierMap = Object.fromEntries(
    tiers.map((t) => [t.id, t])
  );

  function getName(wrestlerId: string | null, tagTeamId: string | null): string {
    if (wrestlerId) return wrestlerMap[wrestlerId] ?? "Unknown";
    if (tagTeamId) return tagTeamMap[tagTeamId] ?? "Unknown";
    return "Unknown";
  }

  // Get relegation matches (Steel Cage)
  const relegationMatches = matches.filter(
    (m) => m.match_phase === "relegation"
  );

  const unplayedRelegationMatches = relegationMatches.filter(
    (m) => !m.played_at
  );
  const playedRelegationMatches = relegationMatches.filter(
    (m) => m.played_at
  );

  async function handleRecordResult(matchId: string, winnerId: string, isTag: boolean) {
    const timeSeconds =
      (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
    if (timeSeconds === 0) {
      toast.error("Enter match time");
      return;
    }
    setLoading(true);
    try {
      await recordMatchResult(matchId, {
        ...(isTag
          ? { winner_tag_team_id: winnerId }
          : { winner_wrestler_id: winnerId }),
        match_time_seconds: timeSeconds,
      });
      toast.success("Result recorded!");
      setMinutes("");
      setSeconds("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteSeason() {
    setLoading(true);
    try {
      await advanceSeasonStatus(season.id, "completed");
      toast.success("Season completed!");
      router.push("/history");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete season");
    } finally {
      setLoading(false);
    }
  }

  const movementColors: Record<string, string> = {
    auto_promote: "bg-green-500/20 text-green-400",
    auto_relegate: "bg-red-500/20 text-red-400",
    playoff_promote: "bg-green-500/20 text-green-400",
    playoff_relegate: "bg-red-500/20 text-red-400",
    playoff_survive: "bg-blue-500/20 text-blue-400",
  };

  const movementLabels: Record<string, string> = {
    auto_promote: "Promoted",
    auto_relegate: "Relegated",
    playoff_promote: "Won Playoff",
    playoff_relegate: "Lost Playoff",
    playoff_survive: "Survived",
  };

  return (
    <div className="space-y-6">
      {/* Relegation events summary */}
      {relegationEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movement Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {relegationEvents.map((evt) => (
                <div key={evt.id} className="flex items-center gap-2">
                  <Badge className={movementColors[evt.movement_type] ?? ""}>
                    {movementLabels[evt.movement_type] ?? evt.movement_type}
                  </Badge>
                  <span className="text-sm font-medium">
                    {getName(evt.wrestler_id, evt.tag_team_id)}
                  </span>
                  {evt.from_tier_id && evt.to_tier_id && (
                    <span className="text-xs text-muted-foreground">
                      T{tierMap[evt.from_tier_id]?.tier_number} &rarr; T
                      {tierMap[evt.to_tier_id]?.tier_number}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Steel Cage matches */}
      {unplayedRelegationMatches.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Steel Cage Relegation Matches</h3>
          {unplayedRelegationMatches.map((m) => {
            const isTag = !!m.tag_team_a_id;
            const aId = (m.wrestler_a_id || m.tag_team_a_id) ?? "";
            const bId = (m.wrestler_b_id || m.tag_team_b_id) ?? "";
            const aName = getName(m.wrestler_a_id, m.tag_team_a_id);
            const bName = getName(m.wrestler_b_id, m.tag_team_b_id);

            return (
              <Card key={m.id}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-wwe-red/20 text-wwe-red">
                      Steel Cage
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {tierMap[m.tier_id]?.short_name || tierMap[m.tier_id]?.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-14 text-sm font-bold"
                      onClick={() => handleRecordResult(m.id, aId, isTag)}
                      disabled={loading}
                    >
                      {aName}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 text-sm font-bold"
                      onClick={() => handleRecordResult(m.id, bId, isTag)}
                      disabled={loading}
                    >
                      {bName}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      min={0}
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                      className="w-16 text-center"
                    />
                    <span>:</span>
                    <Input
                      type="number"
                      placeholder="Sec"
                      min={0}
                      max={59}
                      value={seconds}
                      onChange={(e) => setSeconds(e.target.value)}
                      className="w-16 text-center"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed relegation matches */}
      {playedRelegationMatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completed Relegation Matches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {playedRelegationMatches.map((m) => {
              const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
              const aId = m.wrestler_a_id || m.tag_team_a_id;
              const bId = m.wrestler_b_id || m.tag_team_b_id;
              return (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      winnerId === aId ? "font-bold text-gold" : "text-muted-foreground"
                    }
                  >
                    {getName(m.wrestler_a_id, m.tag_team_a_id)}
                  </span>
                  <span className="text-muted-foreground">vs</span>
                  <span
                    className={
                      winnerId === bId ? "font-bold text-gold" : "text-muted-foreground"
                    }
                  >
                    {getName(m.wrestler_b_id, m.tag_team_b_id)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Complete Season button */}
      {unplayedRelegationMatches.length === 0 && (
        <Button
          size="lg"
          className="bg-gold text-black hover:bg-gold-dark"
          onClick={handleCompleteSeason}
          disabled={loading}
        >
          Complete Season {season.season_number}
        </Button>
      )}
    </div>
  );
}
