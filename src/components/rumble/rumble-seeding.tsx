"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bulkAssignToTier } from "@/app/actions";
import { toast } from "sonner";
import type { PoolLabel } from "@/types/database";

interface Wrestler {
  id: string;
  name: string;
  gender: string;
  overall_rating: number | null;
}

interface Tier {
  id: string;
  tier_number: number;
  name: string;
  short_name: string | null;
  pool_size: number;
  has_pools: boolean;
  division_id: string;
  divisions: { name: string; gender: string; division_type: string } | null;
}

export function RumbleSeeding({
  wrestlers,
  tagTeams,
  tiers,
  season,
}: {
  wrestlers: Wrestler[];
  tagTeams: Array<{ id: string; name: string; wrestler_a: { gender: string } | null }>;
  tiers: Tier[];
  season: { id: string; season_number: number } | null;
}) {
  const router = useRouter();
  const [gender, setGender] = useState<"male" | "female">("male");
  const [rumbleOrder, setRumbleOrder] = useState<string[]>([]);
  const [selectedWrestler, setSelectedWrestler] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredWrestlers = wrestlers.filter(
    (w) => w.gender === gender && !rumbleOrder.includes(w.id)
  );

  const wrestlerMap = Object.fromEntries(
    wrestlers.map((w) => [w.id, w.name])
  );

  function addToOrder() {
    if (!selectedWrestler) return;
    setRumbleOrder([...rumbleOrder, selectedWrestler]);
    setSelectedWrestler("");
  }

  function removeFromOrder(id: string) {
    setRumbleOrder(rumbleOrder.filter((wid) => wid !== id));
  }

  // Auto-assign to tiers based on Rumble finishing order
  // Top finishers go to Tier 1, then fill downward
  async function handleAutoAssign() {
    if (!season) {
      toast.error("Create a season in setup first");
      return;
    }

    const singlesTiers = tiers
      .filter(
        (t) =>
          t.divisions?.division_type === "singles" &&
          t.divisions?.gender === gender
      )
      .sort((a, b) => a.tier_number - b.tier_number);

    if (singlesTiers.length === 0) {
      toast.error("No tiers found for this gender");
      return;
    }

    setLoading(true);
    try {
      const assignments: {
        season_id: string;
        tier_id: string;
        wrestler_id: string;
        pool: PoolLabel | null;
        seed: number;
      }[] = [];

      let wrestlerIdx = 0;
      // Reverse the order: last eliminated = best finisher = seed 1
      const seededOrder = [...rumbleOrder].reverse();

      for (const tier of singlesTiers) {
        const tierSize = tier.pool_size;
        const poolSize = tier.has_pools ? Math.floor(tierSize / 2) : tierSize;

        if (tier.has_pools) {
          // Alternate Pool A and Pool B
          let poolACount = 0;
          let poolBCount = 0;
          for (
            let i = 0;
            i < tierSize && wrestlerIdx < seededOrder.length;
            i++
          ) {
            const pool: PoolLabel =
              poolACount <= poolBCount ? "A" : "B";
            assignments.push({
              season_id: season.id,
              tier_id: tier.id,
              wrestler_id: seededOrder[wrestlerIdx],
              pool,
              seed: wrestlerIdx + 1,
            });
            if (pool === "A") poolACount++;
            else poolBCount++;
            wrestlerIdx++;
          }
        } else {
          for (
            let i = 0;
            i < tierSize && wrestlerIdx < seededOrder.length;
            i++
          ) {
            assignments.push({
              season_id: season.id,
              tier_id: tier.id,
              wrestler_id: seededOrder[wrestlerIdx],
              pool: null,
              seed: wrestlerIdx + 1,
            });
            wrestlerIdx++;
          }
        }
      }

      if (assignments.length > 0) {
        await bulkAssignToTier(assignments);
        toast.success(
          `Assigned ${assignments.length} wrestlers across ${singlesTiers.length} tiers`
        );
        router.refresh();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to assign"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {!season && (
        <Card className="border-yellow-500/50">
          <CardContent className="py-4">
            <p className="text-sm text-yellow-400">
              Create a season in Setup first before assigning Rumble results.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button
          variant={gender === "male" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setGender("male");
            setRumbleOrder([]);
          }}
        >
          Men
        </Button>
        <Button
          variant={gender === "female" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setGender("female");
            setRumbleOrder([]);
          }}
        >
          Women
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Add Elimination Order (first eliminated first)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select
              value={selectedWrestler}
              onValueChange={(v) => setSelectedWrestler(v ?? "")}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select wrestler..." />
              </SelectTrigger>
              <SelectContent>
                {filteredWrestlers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                    {w.overall_rating ? ` (${w.overall_rating})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addToOrder} disabled={!selectedWrestler}>
              Add
            </Button>
          </div>

          {rumbleOrder.length > 0 && (
            <div className="space-y-1">
              {rumbleOrder.map((id, idx) => (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5"
                >
                  <span className="text-sm">
                    <span className="text-muted-foreground mr-2">
                      #{idx + 1}
                    </span>
                    {wrestlerMap[id]}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromOrder(id)}
                    className="h-6 text-xs text-muted-foreground"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2">
                {rumbleOrder.length} wrestlers entered.
                Last entry = winner (Tier 1 Seed 1).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {rumbleOrder.length >= 2 && season && (
        <Button
          size="lg"
          className="bg-gold text-black hover:bg-gold-dark"
          onClick={handleAutoAssign}
          disabled={loading}
        >
          {loading ? "Assigning..." : "Auto-Assign to Tiers"}
        </Button>
      )}
    </div>
  );
}
