import { EmptyState, PageHeader } from "@/components/ui/page-header";
import {
  getActivePlaySeason,
  getSeasonMatches,
  getTagTeams,
  getTiers,
  getWrestlers,
} from "@/lib/data/cached";
import { tierColor } from "@/lib/tiers/colors";
import { ScheduleBoard, type ScheduleMatch, type ScheduleTier } from "@/components/schedule/schedule-board";

export const metadata = { title: "Schedule & Results" };

/** Results are grouped into days on this clock, so a late session stays one day */
const LEAGUE_TIME_ZONE = "America/New_York";
const DIVISION_ORDER = ["Men's Singles", "Women's Singles", "Men's Tag Teams", "Women's Tag Teams"];

export default async function SchedulePage() {
  const season = await getActivePlaySeason();
  if (!season) {
    return (
      <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
        <PageHeader kicker="Fixtures" title="Schedule & Results" />
        <EmptyState title="No active season">The schedule appears once a season is under way.</EmptyState>
      </div>
    );
  }

  const [matches, tiers, wrestlers, tagTeams] = await Promise.all([
    getSeasonMatches(season.id),
    getTiers(),
    getWrestlers(),
    getTagTeams(),
  ]);

  const names = new Map<string, string>();
  for (const w of wrestlers) names.set(w.id, w.name);
  for (const t of tagTeams) names.set(t.id, t.name);

  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: LEAGUE_TIME_ZONE });
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: LEAGUE_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const usedTiers = new Set(matches.map((m) => m.tier_id));
  const scheduleTiers: ScheduleTier[] = tiers
    .filter((t) => usedTiers.has(t.id))
    .map((t) => {
      const division = (t.divisions as { name: string } | null)?.name ?? "Other";
      const c = tierColor(t.slug ?? t.name);
      return {
        id: t.id,
        name: t.name,
        shortName: t.short_name || t.name,
        tierNumber: t.tier_number,
        division,
        bg: c.bg,
        fg: c.fg,
      };
    })
    .sort(
      (a, b) =>
        DIVISION_ORDER.indexOf(a.division) - DIVISION_ORDER.indexOf(b.division) ||
        a.tierNumber - b.tierNumber
    );

  const rows: ScheduleMatch[] = matches
    .filter((m) => (m.wrestler_a_id || m.tag_team_a_id) && (m.wrestler_b_id || m.tag_team_b_id))
    .map((m) => {
      const aId = (m.wrestler_a_id || m.tag_team_a_id)!;
      const bId = (m.wrestler_b_id || m.tag_team_b_id)!;
      const played = m.played_at ? new Date(m.played_at) : null;
      return {
        id: m.id,
        tierId: m.tier_id,
        phase: m.match_phase,
        pool: m.pool,
        round: m.round_number,
        a: names.get(aId) ?? "?",
        b: names.get(bId) ?? "?",
        winner: (m.winner_wrestler_id || m.winner_tag_team_id) === aId ? "a" : m.played_at ? "b" : null,
        seconds: m.match_time_seconds,
        stipulation: m.stipulation,
        playedAt: played ? played.getTime() : null,
        day: played ? dayKey.format(played) : null,
        dayLabel: played ? dayLabel.format(played) : null,
      };
    });

  const playedCount = rows.filter((r) => r.playedAt).length;

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <PageHeader
        kicker={`Season ${season.season_number} · fixtures`}
        title="Schedule & Results"
        stats={[
          { label: "Played", value: playedCount },
          { label: "To play", value: rows.length - playedCount },
        ]}
      />
      <ScheduleBoard matches={rows} tiers={scheduleTiers} />
    </div>
  );
}
