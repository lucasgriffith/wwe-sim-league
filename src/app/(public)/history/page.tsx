import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function HistoryPage() {
  const supabase = await createClient();

  const { data: seasons } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "completed")
    .order("season_number", { ascending: false });

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Season History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {seasons?.length ?? 0} completed seasons
        </p>
      </div>

      {seasons && seasons.length > 0 ? (
        <div className="space-y-3 stagger-children">
          {seasons.map((season) => (
            <Link key={season.id} href={`/history/${season.id}`}>
              <Card className="card-hover cursor-pointer border-border/40 transition-all">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold font-bold tabular-nums">
                      {season.season_number}
                    </div>
                    <div>
                      <span className="text-base font-semibold">
                        Season {season.season_number}
                      </span>
                      {season.started_at && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(season.started_at).toLocaleDateString()} —{" "}
                          {season.completed_at
                            ? new Date(season.completed_at).toLocaleDateString()
                            : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-400">
                      Completed
                    </Badge>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/40 bg-card/30 px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No History Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete a season to see it here.
          </p>
        </div>
      )}
    </div>
  );
}
