import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  getAllAssignments,
  getAllMatches,
  getChampions,
  getCurrentSeason,
  getTagTeams,
  getTiers,
  getWrestlers,
} from "@/lib/data/cached";
import { buildEloBoard } from "@/lib/elo/board";
import { BASE_RATING } from "@/lib/elo/compute-elo";
import { buildTagSeason, ordinal } from "@/lib/tag-teams/season";
import { tierColor } from "@/lib/tiers/colors";
import {
  TagTeamList,
  type TeamInfo,
  type WallTier,
} from "@/components/tag-teams/tag-team-list";
import { sortByName } from "@/lib/utils/sort-name";

export default async function TagTeamsPage() {
  const supabase = await createClient();

  const [
    tagTeams,
    allWrestlers,
    matches,
    assignments,
    tiers,
    season,
    champions,
    { data: { user } },
  ] = await Promise.all([
    getTagTeams(),
    getWrestlers(),
    getAllMatches(),
    getAllAssignments(),
    getTiers(),
    getCurrentSeason(),
    getChampions(),
    supabase.auth.getUser(),
  ]);
  const wrestlers = allWrestlers.filter((w) => w.is_active);

  const board = buildEloBoard(matches, allWrestlers, tagTeams);
  const tagSeason = buildTagSeason(
    tiers,
    season ? assignments.filter((a) => a.season_id === season.id) : [],
    season ? matches.filter((m) => m.season_id === season.id) : []
  );

  const onRecord = new Map<string, number>();
  for (const m of matches) {
    for (const id of [m.tag_team_a_id, m.tag_team_b_id]) {
      if (id) onRecord.set(id, (onRecord.get(id) ?? 0) + 1);
    }
  }

  const info: Record<string, TeamInfo> = {};
  for (const t of tagTeams) {
    const s = board.standings.get(t.id);
    const place = tagSeason.places.get(t.id);
    info[t.id] = {
      rating: s?.rating ?? Math.round(board.seeds.get(t.id) ?? BASE_RATING),
      rank: s?.rank ?? null,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      tierId: place?.tier.id ?? null,
      place: place?.poolPlace ?? null,
      pool: place?.pool ?? null,
      placeLabel: place ? `${place.pool ? `Pool ${place.pool} · ` : ""}${ordinal(place.poolPlace)}` : null,
      zone: !place
        ? null
        : place.zone === "playoff"
          ? "playoff"
          : place.zone === "wildcard"
            ? "wildcard"
            : place.zone === "relplayoff"
            ? "cage"
            : place.zone === "autorel"
              ? "drop"
              : null,
      champion: champions[t.id]?.beltName ?? null,
      matches: onRecord.get(t.id) ?? 0,
    };
  }

  const wallTiers: WallTier[] = tagSeason.tiers.map((t) => {
    const c = tierColor(t.slug ?? t.name);
    return {
      id: t.id,
      href: `/tiers/${t.slug ?? t.id}`,
      name: t.name,
      tierNumber: t.tierNumber,
      women: t.women,
      bg: c.bg,
      fg: c.fg,
      progress: `${t.played} of ${t.scheduled} matches played`,
    };
  });

  const women = tagTeams.filter(
    (t) => (t.wrestler_a as { gender?: string } | null)?.gender === "female"
  ).length;

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <PageHeader
        kicker="The tag division"
        title="Tag Teams"
        stats={[
          { label: "Teams", value: tagTeams.length },
          { label: "Men's", value: tagTeams.length - women },
          { label: "Women's", value: women },
          { label: "Titles", value: wallTiers.length },
        ]}
      />
      <TagTeamList
        tagTeams={tagTeams ?? []}
        wrestlers={sortByName(wrestlers ?? [])}
        info={info}
        tiers={wallTiers}
        isAdmin={!!user}
      />
    </div>
  );
}
