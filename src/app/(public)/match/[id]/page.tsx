import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllMatches, getTagTeams, getWrestlers } from "@/lib/data/cached";
import { buildEloBoard, POOL_LABEL } from "@/lib/elo/board";
import { winProbability, BASE_RATING } from "@/lib/elo/compute-elo";
import { SmartImage } from "@/components/ui/smart-image";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const PHASE: Record<string, string> = {
  pool_play: "Pool Play",
  quarterfinal: "Quarterfinal",
  semifinal: "Semifinal",
  final: "Championship Final",
  relegation: "Relegation Match",
};

interface Side {
  id: string;
  name: string;
  href: string;
  images: (string | null)[];
  ovr: string;
  rank: number | null;
  pool: string;
  elo: number;
  record: string;
  streak: string;
  avgWin: string;
  bestWin: string;
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [matches, wrestlers, tagTeams] = await Promise.all([
    getAllMatches(),
    getWrestlers(),
    getTagTeams(),
  ]);
  const match = matches.find((m) => m.id === id);
  if (!match) notFound();

  const board = buildEloBoard(matches, wrestlers, tagTeams);
  const isTag = !!match.tag_team_a_id;
  const aId = (match.wrestler_a_id || match.tag_team_a_id) as string | null;
  const bId = (match.wrestler_b_id || match.tag_team_b_id) as string | null;
  const wrestlerById = new Map(wrestlers.map((w) => [w.id, w]));
  const teamById = new Map(tagTeams.map((t) => [t.id, t]));
  const nameOf = (pid: string) =>
    wrestlerById.get(pid)?.name ?? teamById.get(pid)?.name ?? "?";

  const played = matches.filter(
    (m) => m.played_at && (m.winner_wrestler_id || m.winner_tag_team_id)
  );

  function side(pid: string | null): Side | null {
    if (!pid) return null;
    const standing = board.standings.get(pid);
    const entry = board.entries.get(pid);
    const w = wrestlerById.get(pid);
    const t = teamById.get(pid);
    const members = t
      ? [wrestlerById.get(t.wrestler_a_id), wrestlerById.get(t.wrestler_b_id)]
      : [];
    const history = entry?.history ?? [];
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const won = history[i].won;
      if (streak === 0) streak = won ? 1 : -1;
      else if (streak > 0 && won) streak++;
      else if (streak < 0 && !won) streak--;
      else break;
    }
    const wins = played.filter(
      (m) =>
        (m.winner_wrestler_id || m.winner_tag_team_id) === pid &&
        (m.match_time_seconds ?? 0) > 0
    );
    const avgWin = wins.length
      ? formatTime(
          Math.round(wins.reduce((s, m) => s + m.match_time_seconds!, 0) / wins.length)
        )
      : "—";
    const ovrs = t
      ? members.map((m) => m?.overall_rating).filter((o): o is number => o != null)
      : w?.overall_rating != null
        ? [w.overall_rating]
        : [];
    return {
      id: pid,
      name: nameOf(pid),
      href: t ? `/tag-teams/${pid}` : `/roster/${w?.slug ?? pid}`,
      images: t ? members.map((m) => m?.image_url ?? null) : [w?.image_url ?? null],
      ovr: ovrs.length
        ? Math.round(ovrs.reduce((s, o) => s + o, 0) / ovrs.length).toString()
        : "—",
      rank: standing?.rank ?? null,
      pool: standing ? POOL_LABEL[standing.pool] : "",
      elo: standing?.rating ?? Math.round(board.seeds.get(pid) ?? BASE_RATING),
      record: standing ? `${standing.wins}-${standing.losses}` : "0-0",
      streak: streak > 0 ? `W${streak}` : streak < 0 ? `L${-streak}` : "—",
      avgWin,
      bestWin: standing?.bestWin
        ? `${nameOf(standing.bestWin.opponentId)} (${standing.bestWin.opponentRating})`
        : "—",
    };
  }

  const a = side(aId);
  const b = side(bId);
  const winnerId = match.winner_wrestler_id || match.winner_tag_team_id;
  const odds = board.odds.get(match.id);

  // For a played match, show the odds as they stood going in
  let probA: number | null = null;
  if (a && b) {
    if (odds && winnerId) {
      probA = winnerId === a.id ? odds.winnerProb : 1 - odds.winnerProb;
    } else {
      probA = winProbability(a.elo, b.elo);
    }
  }
  const pctA = probA != null ? Math.round(probA * 100) : null;

  const meetings =
    a && b
      ? played
          .filter((m) => {
            const x = m.wrestler_a_id || m.tag_team_a_id;
            const y = m.wrestler_b_id || m.tag_team_b_id;
            return (
              m.id !== match.id &&
              ((x === a.id && y === b.id) || (x === b.id && y === a.id))
            );
          })
          .sort(
            (x, y) => new Date(y.played_at!).getTime() - new Date(x.played_at!).getTime()
          )
      : [];
  const aSeriesWins = meetings.filter(
    (m) => (m.winner_wrestler_id || m.winner_tag_team_id) === a?.id
  ).length;

  const rows: Array<[string, (s: Side) => string]> = [
    ["Elo rating", (s) => s.elo.toString()],
    ["Career record", (s) => s.record],
    ["Streak", (s) => s.streak],
    [isTag ? "Avg 2K overall" : "2K overall", (s) => s.ovr],
    ["Avg time of wins", (s) => s.avgWin],
    ["Best win", (s) => s.bestWin],
  ];

  return (
    <div className="container max-w-4xl px-4 py-8 animate-fade-in">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/70">
          {match.tiers?.name ?? "Match"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {PHASE[match.match_phase] ?? match.match_phase}
          {match.pool ? ` · Pool ${match.pool}` : ""}
          {match.seasons?.season_number ? ` · Season ${match.seasons.season_number}` : ""}
          {match.stipulation ? ` · ${match.stipulation}` : ""}
        </p>
      </div>

      {/* The matchup */}
      <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-8">
        {[a, null, b].map((s, i) =>
          i === 1 ? (
            <div key="vs" className="pt-14 text-center sm:pt-20">
              <span className="text-2xl font-black text-muted-foreground/20 sm:text-4xl">VS</span>
            </div>
          ) : s ? (
            <Link key={s.id} href={s.href} className="group flex flex-col items-center text-center">
              <div className="flex -space-x-6">
                {s.images.map((img, k) =>
                  img ? (
                    <SmartImage
                      key={k}
                      src={img}
                      alt=""
                      width={250}
                      height={250}
                      className={`h-28 w-28 rounded-2xl border-2 object-cover shadow-xl sm:h-40 sm:w-40 ${
                        winnerId === s.id ? "border-gold" : winnerId ? "border-border/30 opacity-60" : "border-gold/30"
                      }`}
                    />
                  ) : (
                    <div
                      key={k}
                      className="flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-border/30 bg-muted/20 text-3xl font-bold text-muted-foreground/20 sm:h-40 sm:w-40"
                    >
                      {s.name.charAt(0)}
                    </div>
                  )
                )}
              </div>
              <p className="mt-3 text-lg font-bold leading-tight transition-colors group-hover:text-gold sm:text-2xl">
                {s.rank != null && (
                  <span className="mr-1.5 align-[0.12em] text-sm font-bold tabular-nums text-gold sm:text-base">
                    #{s.rank}
                  </span>
                )}
                {s.name}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/60">{s.pool}</p>
              {winnerId === s.id && (
                <span className="mt-2 rounded-full bg-gold/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                  Winner{match.match_time_seconds ? ` · ${formatTime(match.match_time_seconds)}` : ""}
                </span>
              )}
            </Link>
          ) : (
            <div key={i} className="pt-14 text-center text-sm italic text-muted-foreground/40">
              To be decided
            </div>
          )
        )}
      </div>

      {a && b && pctA != null && (
        <>
          {/* Win probability */}
          <div className="mt-8">
            <div className="flex items-end justify-between">
              <span className={`text-3xl font-black tabular-nums ${pctA >= 50 ? "text-gold" : "text-muted-foreground/60"}`}>
                {pctA}%
              </span>
              <span className="pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">
                {winnerId ? "Pre-match win probability" : "Win probability"}
              </span>
              <span className={`text-3xl font-black tabular-nums ${pctA < 50 ? "text-gold" : "text-muted-foreground/60"}`}>
                {100 - pctA}%
              </span>
            </div>
            <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-muted/20">
              <div className="h-full bg-gold" style={{ width: `${pctA}%` }} />
              <div className="h-full flex-1 bg-foreground/20" />
            </div>
            {odds && odds.winnerProb < 0.35 && (
              <p className="mt-3 text-center text-sm font-bold uppercase tracking-wider text-wwe-red">
                Upset — the winner had a {Math.round(odds.winnerProb * 100)}% chance
                {odds.winnerDelta ? ` (+${odds.winnerDelta} Elo)` : ""}
              </p>
            )}
          </div>

          {/* Tale of the tape */}
          <div className="mt-8 overflow-hidden rounded-xl border border-border/40">
            {rows.map(([label, get], i) => (
              <div
                key={label}
                className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 text-sm ${i > 0 ? "border-t border-border/20" : ""}`}
              >
                <span className="font-semibold tabular-nums">{get(a)}</span>
                <span className="w-32 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  {label}
                </span>
                <span className="text-right font-semibold tabular-nums">{get(b)}</span>
              </div>
            ))}
          </div>

          {/* Series history */}
          <div className="mt-8">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Head-to-head
              {meetings.length > 0 && (
                <span className="ml-2 normal-case tracking-normal text-foreground">
                  {a.name} {aSeriesWins}–{meetings.length - aSeriesWins} {b.name}
                </span>
              )}
            </h2>
            {meetings.length === 0 ? (
              <p className="text-sm text-muted-foreground/60">
                {winnerId ? "This was their first meeting." : "First-ever meeting."}
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/40">
                {meetings.map((m, i) => {
                  const w = (m.winner_wrestler_id || m.winner_tag_team_id)!;
                  return (
                    <Link
                      key={m.id}
                      href={`/match/${m.id}`}
                      className={`flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/10 ${i > 0 ? "border-t border-border/20" : ""}`}
                    >
                      <span>
                        <span className="font-semibold text-gold">{nameOf(w)}</span>
                        <span className="text-muted-foreground/60"> won</span>
                      </span>
                      <span className="text-xs text-muted-foreground/60">
                        {m.tiers?.short_name || m.tiers?.name} · S{m.seasons?.season_number}
                        {m.match_time_seconds ? ` · ${formatTime(m.match_time_seconds)}` : ""}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
