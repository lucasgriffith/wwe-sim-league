import Link from "next/link";
import { getAllMatches, getTagTeams, getWrestlers } from "@/lib/data/cached";
import { buildEloBoard, POOL_LABEL, type EloPool, type EloStanding } from "@/lib/elo/board";
import { SmartImage } from "@/components/ui/smart-image";

export default async function RankingsPage() {
  const [matches, wrestlers, tagTeams] = await Promise.all([
    getAllMatches(),
    getWrestlers(),
    getTagTeams(),
  ]);
  const board = buildEloBoard(matches, wrestlers, tagTeams);

  const info = new Map<string, { name: string; href: string; image: string | null }>();
  for (const w of wrestlers) {
    info.set(w.id, { name: w.name, href: `/roster/${w.slug ?? w.id}`, image: w.image_url });
  }
  for (const t of tagTeams) {
    info.set(t.id, { name: t.name, href: `/tag-teams/${t.id}`, image: null });
  }

  const hasAny = Object.values(board.ranked).some((list) => list.length > 0);

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Elo Rankings</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every match moves the ratings: beat someone rated above you and you
          climb fast, lose to someone below you and you fall hard. Playoff
          matches count 25% more, title matches 50% more.
        </p>
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-dashed border-border/40 bg-card/30 px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No rankings yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Rankings appear once matches have been played.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {(["men", "women", "men-tag", "women-tag"] as EloPool[]).map((pool) => (
            <Poll
              key={pool}
              title={`${POOL_LABEL[pool]} ${pool.endsWith("tag") ? "Division" : "Singles"}`}
              rows={board.ranked[pool].slice(0, pool.endsWith("tag") ? 15 : 25)}
              total={board.ranked[pool].length}
              info={info}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Movement({ s }: { s: EloStanding }) {
  if (s.previousRank == null) {
    return <span className="text-[9px] font-bold uppercase text-sky-400/80">new</span>;
  }
  const change = s.previousRank - s.rank;
  if (change === 0) return <span className="text-muted-foreground/30">–</span>;
  return (
    <span className={`text-[10px] font-semibold tabular-nums ${change > 0 ? "text-emerald-400" : "text-red-400"}`}>
      {change > 0 ? "▲" : "▼"}
      {Math.abs(change)}
    </span>
  );
}

function Poll({
  title,
  rows,
  total,
  info,
}: {
  title: string;
  rows: EloStanding[];
  total: number;
  info: Map<string, { name: string; href: string; image: string | null }>;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <div className="rule-title mb-0 flex items-baseline justify-between">
        <h2 className="text-2xl">{title}</h2>
        <span className="text-xs text-muted-foreground/60">
          Top {rows.length} of {total}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/20 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              <th className="w-10 px-2 py-2 text-right">#</th>
              <th className="w-9 px-1 py-2 text-center" aria-label="Movement" />
              <th className="px-2 py-2 text-left">Name</th>
              <th className="w-14 px-2 py-2 text-center">W-L</th>
              <th className="hidden w-14 px-2 py-2 text-right sm:table-cell">Peak</th>
              <th className="w-12 px-2 py-2 text-right">Last</th>
              <th className="w-16 px-3 py-2 text-right">Elo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const p = info.get(s.id) ?? { name: "?", href: "#", image: null };
              return (
                <tr
                  key={s.id}
                  className={`border-t border-border/10 ${s.rank === 1 ? "bg-gold/[0.05]" : ""}`}
                >
                  <td className={`font-display px-2 py-2 text-right text-2xl font-black ${s.rank === 1 ? "text-gold" : s.rank <= 5 ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.rank}
                  </td>
                  <td className="px-1 py-2 text-center">
                    <Movement s={s} />
                  </td>
                  <td className="px-2 py-2">
                    <Link href={p.href} className="group flex items-center gap-2">
                      {p.image ? (
                        <SmartImage
                          src={p.image}
                          alt=""
                          width={56}
                          height={56}
                          className="h-7 w-7 shrink-0 rounded-full border border-border/20 object-cover"
                        />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/20 bg-muted/20 text-[10px] font-bold text-muted-foreground/40">
                          {p.name.charAt(0)}
                        </span>
                      )}
                      <span className="font-display truncate text-lg font-extrabold transition-colors group-hover:text-gold">
                        {p.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums text-muted-foreground">
                    {s.wins}-{s.losses}
                  </td>
                  <td className="hidden px-2 py-2 text-right text-xs tabular-nums text-muted-foreground/60 sm:table-cell">
                    {s.peak}
                  </td>
                  <td className={`px-2 py-2 text-right text-xs font-semibold tabular-nums ${s.lastDelta > 0 ? "text-emerald-400" : s.lastDelta < 0 ? "text-red-400" : "text-muted-foreground/40"}`}>
                    {s.lastDelta > 0 ? `+${s.lastDelta}` : s.lastDelta || "–"}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-gold">
                    {s.rating}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
