import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const divisionBgColors: Record<string, string> = {
  "Men's Singles": "from-blue-500/8 to-blue-500/0 hover:border-blue-500/20",
  "Women's Singles": "from-purple-500/8 to-purple-500/0 hover:border-purple-500/20",
  "Men's Tag Teams": "from-emerald-500/8 to-emerald-500/0 hover:border-emerald-500/20",
  "Women's Tag Teams": "from-orange-500/8 to-orange-500/0 hover:border-orange-500/20",
};

const divisionTextColors: Record<string, string> = {
  "Men's Singles": "text-blue-400",
  "Women's Singles": "text-purple-400",
  "Men's Tag Teams": "text-emerald-400",
  "Women's Tag Teams": "text-orange-400",
};

const divisionAccents: Record<string, string> = {
  "Men's Singles": "bg-blue-500",
  "Women's Singles": "bg-purple-500",
  "Men's Tag Teams": "bg-emerald-500",
  "Women's Tag Teams": "bg-orange-500",
};

export default async function TiersPage() {
  const supabase = await createClient();

  const { data: divisions } = await supabase
    .from("divisions")
    .select("*")
    .order("display_order");

  const { data: tiers } = await supabase
    .from("tiers")
    .select("*")
    .order("tier_number");

  const tiersByDivision = (divisions ?? []).map((div) => ({
    ...div,
    tiers: (tiers ?? []).filter((t) => t.division_id === div.id),
  }));

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Championship Tiers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tiers?.length ?? 0} championships across {divisions?.length ?? 0} divisions
        </p>
      </div>

      {tiersByDivision.map((division) => (
        <div key={division.id} className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <div className={`h-4 w-1 rounded-full ${divisionAccents[division.name] ?? "bg-muted"}`} />
            <h2 className={`text-lg font-semibold ${divisionTextColors[division.name] ?? ""}`}>
              {division.name}
            </h2>
            <span className="text-xs text-muted-foreground/60">
              {division.tiers.length} tiers
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
            {division.tiers.map((tier) => (
              <Link key={tier.id} href={`/tiers/${tier.id}`}>
                <Card
                  className={`card-hover cursor-pointer bg-gradient-to-br border-border/40 transition-all relative overflow-hidden ${
                    divisionBgColors[division.name] ?? ""
                  }`}
                >
                  {/* Belt watermark */}
                  {tier.belt_image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={tier.belt_image_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-contain opacity-[0.2] pointer-events-none scale-105"
                    />
                  )}
                  <CardHeader className="pb-2 relative">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: tier.color ?? undefined, borderColor: tier.color ? `${tier.color}40` : undefined }}
                      >
                        Tier {tier.tier_number}
                      </Badge>
                      {tier.short_name && (
                        <span className="text-[11px] font-mono text-muted-foreground/50">
                          {tier.short_name}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-sm leading-tight mt-1">
                      {tier.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 relative">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{tier.has_pools ? "2 Pools + Playoff" : "Round Robin + Final"}</span>
                      <span className="text-muted-foreground/30">&middot;</span>
                      <span>{tier.pool_size} participants</span>
                    </div>
                    {tier.fixed_stipulation && (
                      <Badge variant="secondary" className="mt-2 text-[10px] bg-wwe-red/10 text-wwe-red border-0">
                        {tier.fixed_stipulation}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
