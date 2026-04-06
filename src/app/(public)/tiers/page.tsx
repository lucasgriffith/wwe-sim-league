import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
/* eslint-disable @next/next/no-img-element */

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

const divisionBorderHover: Record<string, string> = {
  "Men's Singles": "hover:border-blue-500/30",
  "Women's Singles": "hover:border-purple-500/30",
  "Men's Tag Teams": "hover:border-emerald-500/30",
  "Women's Tag Teams": "hover:border-orange-500/30",
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
              <Link key={tier.id} href={`/tiers/${tier.slug}`}>
                <div
                  className={`group relative rounded-xl border border-border/40 overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 ${
                    divisionBorderHover[division.name] ?? "hover:border-border/60"
                  } ${tier.belt_image_url ? "h-48" : "h-auto"}`}
                >
                  {/* Belt image — prominent, vivid */}
                  {tier.belt_image_url ? (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/95" />
                      {/* Top left tier badge */}
                      <div className="absolute top-2.5 left-3 z-10 flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-[9px] font-semibold uppercase tracking-wider bg-background/60 backdrop-blur-sm"
                          style={{
                            color: tier.color ?? undefined,
                            borderColor: tier.color ? `${tier.color}40` : undefined,
                          }}
                        >
                          T{tier.tier_number}
                        </Badge>
                        {tier.short_name && (
                          <span className="text-[10px] font-mono text-muted-foreground/70 bg-background/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                            {tier.short_name}
                          </span>
                        )}
                      </div>
                      <img
                        src={tier.belt_image_url}
                        alt=""
                        className="absolute -inset-5 w-[calc(100%+2.5rem)] h-[calc(100%+2.5rem)] object-contain pb-8 transition-transform group-hover:scale-105"
                      />
                      {/* Bottom overlay with text */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background via-background/90 to-transparent">
                        <h3 className="text-sm font-bold leading-tight text-foreground">
                          {tier.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/60">
                          <span>{tier.has_pools ? "2 Pools + Playoff" : "Round Robin"}</span>
                          <span className="text-muted-foreground/20">·</span>
                          <span>{tier.pool_size}</span>
                          {tier.fixed_stipulation && (
                            <>
                              <span className="text-muted-foreground/20">·</span>
                              <span className="text-wwe-red/70">{tier.fixed_stipulation}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* No belt image — clean card fallback */
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className="text-[9px] font-semibold uppercase tracking-wider"
                          style={{
                            color: tier.color ?? undefined,
                            borderColor: tier.color ? `${tier.color}40` : undefined,
                          }}
                        >
                          T{tier.tier_number}
                        </Badge>
                        {tier.short_name && (
                          <span className="text-[10px] font-mono text-muted-foreground/50">
                            {tier.short_name}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold leading-tight mb-2">
                        {tier.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                        <span>{tier.has_pools ? "2 Pools + Playoff" : "Round Robin"}</span>
                        <span className="text-muted-foreground/20">·</span>
                        <span>{tier.pool_size}</span>
                        {tier.fixed_stipulation && (
                          <>
                            <span className="text-muted-foreground/20">·</span>
                            <span className="text-wwe-red/70">{tier.fixed_stipulation}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
