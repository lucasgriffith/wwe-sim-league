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
    <div className="container max-w-screen-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Season History</h1>

      {seasons && seasons.length > 0 ? (
        <div className="space-y-3">
          {seasons.map((season) => (
            <Link key={season.id} href={`/history/${season.id}`}>
              <Card className="cursor-pointer transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <span className="text-lg font-semibold">
                      Season {season.season_number}
                    </span>
                    {season.started_at && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(season.started_at).toLocaleDateString()} -{" "}
                        {season.completed_at
                          ? new Date(season.completed_at).toLocaleDateString()
                          : ""}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">Completed</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">
          No completed seasons yet.
        </p>
      )}
    </div>
  );
}
