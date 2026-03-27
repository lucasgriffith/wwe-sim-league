import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function ExportPage() {
  const supabase = await createClient();
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, season_number, status")
    .order("season_number", { ascending: false });

  const exports = [
    {
      title: "Roster",
      description: "All wrestlers with gender, brand, overall rating, and active status",
      href: "/api/export/roster",
      icon: "👤",
    },
    {
      title: "Dynasty Stats",
      description: "Career statistics for all active wrestlers — wins, losses, win%, titles, playoff record",
      href: "/api/export/dynasty",
      icon: "🏆",
    },
    {
      title: "All Match History",
      description: "Every match result across all seasons",
      href: "/api/export/matches",
      icon: "📊",
    },
  ];

  return (
    <div className="container max-w-screen-md px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Export Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Download league data as CSV files
        </p>
      </div>

      <div className="space-y-3">
        {exports.map((exp) => (
          <Card key={exp.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{exp.icon}</span>
                {exp.title}
              </CardTitle>
              <CardDescription className="text-xs">{exp.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={exp.href} download>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download CSV
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}

        {/* Per-season exports */}
        {(seasons ?? []).length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Season Match Data
            </h2>
            <div className="space-y-2">
              {(seasons ?? []).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border/30 bg-card/30 px-4 py-3"
                >
                  <span className="text-sm">
                    Season {s.season_number}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({s.status.replace("_", " ")})
                    </span>
                  </span>
                  <Link href={`/api/export/matches?season=${s.id}`} download>
                    <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      CSV
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
