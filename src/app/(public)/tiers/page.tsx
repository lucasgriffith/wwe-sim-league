import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const divisionColors: Record<string, string> = {
  "Men's Singles": "border-division-mens-singles",
  "Women's Singles": "border-division-womens-singles",
  "Men's Tag Teams": "border-division-mens-tag",
  "Women's Tag Teams": "border-division-womens-tag",
};

const divisionTextColors: Record<string, string> = {
  "Men's Singles": "text-division-mens-singles",
  "Women's Singles": "text-division-womens-singles",
  "Men's Tag Teams": "text-division-mens-tag",
  "Women's Tag Teams": "text-division-womens-tag",
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
    <div className="container max-w-screen-2xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Championship Tiers</h1>

      {tiersByDivision.map((division) => (
        <div key={division.id} className="mb-10">
          <h2
            className={`mb-4 text-xl font-semibold ${
              divisionTextColors[division.name] ?? ""
            }`}
          >
            {division.name}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {division.tiers.map((tier) => (
              <Link key={tier.id} href={`/tiers/${tier.id}`}>
                <Card
                  className={`cursor-pointer border-l-4 transition-colors hover:bg-accent/50 ${
                    divisionColors[division.name] ?? ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ color: tier.color ?? undefined }}
                      >
                        Tier {tier.tier_number}
                      </Badge>
                      {tier.short_name && (
                        <span className="text-xs text-muted-foreground">
                          {tier.short_name}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-sm leading-tight">
                      {tier.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      {tier.has_pools ? "2 Pools + Playoff" : "Round Robin + Final"}{" "}
                      &middot; {tier.pool_size} participants
                    </p>
                    {tier.fixed_stipulation && (
                      <Badge variant="secondary" className="mt-1 text-xs">
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
