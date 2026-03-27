"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Wrestler {
  id: string;
  name: string;
  gender: string;
  overall_rating: number | null;
}

interface Stats {
  wins: number;
  losses: number;
  total: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CompareView({
  wrestlers,
  selectedA,
  selectedB,
  wrestlerA,
  wrestlerB,
  statsA,
  statsB,
  h2hA,
  h2hB,
  h2hMatches,
}: {
  wrestlers: Wrestler[];
  selectedA: string;
  selectedB: string;
  wrestlerA: Wrestler | null;
  wrestlerB: Wrestler | null;
  statsA: Stats | null;
  statsB: Stats | null;
  h2hA: number;
  h2hB: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  h2hMatches: any[];
}) {
  const router = useRouter();

  function navigate(a: string, b: string) {
    const params = new URLSearchParams();
    if (a) params.set("a", a);
    if (b) params.set("b", b);
    router.push(`/compare?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      {/* Wrestler Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <Select
          value={selectedA}
          onValueChange={(v) => navigate(v ?? "", selectedB)}
        >
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select wrestler..." />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {wrestlers
              .filter((w) => w.id !== selectedB)
              .map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedB}
          onValueChange={(v) => navigate(selectedA, v ?? "")}
        >
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select wrestler..." />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {wrestlers
              .filter((w) => w.id !== selectedA)
              .map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Comparison */}
      {wrestlerA && wrestlerB && (
        <div className="space-y-6">
          {/* H2H Record */}
          <div className="rounded-xl border border-border/40 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 p-6">
            <h2 className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 mb-4">
              Head to Head
            </h2>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className={`text-4xl font-black tabular-nums ${h2hA > h2hB ? "text-gold" : "text-muted-foreground/50"}`}>
                  {h2hA}
                </div>
                <div className="text-sm font-medium mt-1">{wrestlerA.name}</div>
              </div>
              <div className="text-2xl font-bold text-muted-foreground/20">—</div>
              <div className="text-center">
                <div className={`text-4xl font-black tabular-nums ${h2hB > h2hA ? "text-gold" : "text-muted-foreground/50"}`}>
                  {h2hB}
                </div>
                <div className="text-sm font-medium mt-1">{wrestlerB.name}</div>
              </div>
            </div>
            {h2hMatches.length === 0 && (
              <p className="text-center text-xs text-muted-foreground/50 mt-3">
                These wrestlers have never faced each other
              </p>
            )}
          </div>

          {/* Stat Comparison Bars */}
          <div className="space-y-3">
            <CompareBar
              labelA={wrestlerA.name}
              labelB={wrestlerB.name}
              valueA={statsA?.wins ?? 0}
              valueB={statsB?.wins ?? 0}
              label="Career Wins"
            />
            <CompareBar
              labelA={wrestlerA.name}
              labelB={wrestlerB.name}
              valueA={statsA ? (statsA.total > 0 ? Math.round((statsA.wins / statsA.total) * 100) : 0) : 0}
              valueB={statsB ? (statsB.total > 0 ? Math.round((statsB.wins / statsB.total) * 100) : 0) : 0}
              label="Win %"
              suffix="%"
            />
            <CompareBar
              labelA={wrestlerA.name}
              labelB={wrestlerB.name}
              valueA={wrestlerA.overall_rating ?? 0}
              valueB={wrestlerB.overall_rating ?? 0}
              label="Overall Rating"
            />
            <CompareBar
              labelA={wrestlerA.name}
              labelB={wrestlerB.name}
              valueA={statsA?.total ?? 0}
              valueB={statsB?.total ?? 0}
              label="Matches Played"
            />
          </div>

          {/* Match History */}
          {h2hMatches.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 mb-3">
                Match History
              </h3>
              <div className="space-y-1.5">
                {h2hMatches.map((m) => {
                  const winnerId = m.winner_wrestler_id;
                  const winnerName = winnerId === selectedA ? wrestlerA.name : wrestlerB.name;
                  const loserName = winnerId === selectedA ? wrestlerB.name : wrestlerA.name;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-md border border-border/20 bg-card/30 px-3 py-2 text-xs"
                    >
                      <span className="font-bold text-gold truncate">{winnerName}</span>
                      <span className="text-muted-foreground/40">def.</span>
                      <span className="text-muted-foreground/60 truncate">{loserName}</span>
                      {m.stipulation && (
                        <Badge className="bg-wwe-red/10 text-wwe-red/60 text-[9px] border-0 ml-auto shrink-0">
                          {m.stipulation}
                        </Badge>
                      )}
                      {m.match_time_seconds && (
                        <span className="tabular-nums text-muted-foreground/30 shrink-0">
                          {formatTime(m.match_time_seconds)}
                        </span>
                      )}
                      {m.seasons?.season_number && (
                        <span className="text-muted-foreground/20 shrink-0">
                          S{m.seasons.season_number}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompareBar({
  valueA,
  valueB,
  label,
  suffix = "",
}: {
  labelA: string;
  labelB: string;
  valueA: number;
  valueB: number;
  label: string;
  suffix?: string;
}) {
  const max = Math.max(valueA, valueB, 1);
  const pctA = (valueA / max) * 100;
  const pctB = (valueB / max) * 100;

  return (
    <div className="rounded-lg border border-border/20 bg-card/20 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 mb-2 text-center">
        {label}
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-bold tabular-nums w-12 text-right ${valueA >= valueB ? "text-gold" : "text-muted-foreground/50"}`}>
          {valueA}{suffix}
        </span>
        <div className="flex-1 flex gap-1 h-3">
          <div className="flex-1 flex justify-end">
            <div
              className={`h-full rounded-l-sm transition-all ${valueA >= valueB ? "bg-gold/40" : "bg-muted/20"}`}
              style={{ width: `${pctA}%` }}
            />
          </div>
          <div className="flex-1">
            <div
              className={`h-full rounded-r-sm transition-all ${valueB >= valueA ? "bg-gold/40" : "bg-muted/20"}`}
              style={{ width: `${pctB}%` }}
            />
          </div>
        </div>
        <span className={`text-sm font-bold tabular-nums w-12 ${valueB >= valueA ? "text-gold" : "text-muted-foreground/50"}`}>
          {valueB}{suffix}
        </span>
      </div>
    </div>
  );
}
