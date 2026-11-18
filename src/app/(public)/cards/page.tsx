import {
  getAllMatches,
  getChampions,
  getCurrentSeason,
  getSeasonAssignments,
  getTagTeams,
  getTiers,
  getWrestlers,
} from "@/lib/data/cached";
import { buildCards } from "@/lib/cards/build-cards";
import { CardBinder } from "@/components/cards/card-binder";
import { PageHeader } from "@/components/ui/page-header";

export default async function CardsPage() {
  const [wrestlers, tagTeams, matches, tiers, champions, season] = await Promise.all([
    getWrestlers(),
    getTagTeams(),
    getAllMatches(),
    getTiers(),
    getChampions(),
    getCurrentSeason(),
  ]);
  const assignments = season ? await getSeasonAssignments(season.id) : [];

  const cards = buildCards({
    wrestlers,
    tagTeams,
    matches,
    tiers,
    assignments,
    championIds: new Set(Object.keys(champions)),
    seasonNumber: season?.season_number ?? null,
  });
  const count = (r: string) => cards.filter((c) => c.rarity === r).length;

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <PageHeader
        kicker="The set"
        title="Trading Cards"
        description="One card for every wrestler. Frames follow form: champions are holographic, the top 5 of each Elo poll are gold, the rest of the top 25 silver. Plates take the colour of the title they are chasing."
        stats={[
          { label: "Cards", value: cards.length },
          { label: "Champion", value: count("champion") },
          { label: "Main event", value: count("main-event") },
          { label: "Ranked", value: count("ranked") },
        ]}
      />
      <CardBinder cards={cards} />
    </div>
  );
}
