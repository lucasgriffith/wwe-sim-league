import { createClient } from "@/lib/supabase/server";
import { getAllMatches, getTagTeams, getWrestlers } from "@/lib/data/cached";
import { buildEloBoard } from "@/lib/elo/board";
import { PageHeader } from "@/components/ui/page-header";
import { WrestlerTable } from "@/components/roster/wrestler-table";
import { FetchImagesButton } from "@/components/roster/fetch-images-button";
import { AuditImagesButton } from "@/components/roster/audit-images-button";
import { sortByName } from "@/lib/utils/sort-name";

export default async function RosterPage() {
  const supabase = await createClient();

  const [wrestlers, matches, tagTeams, { data: { user } }] = await Promise.all([
    getWrestlers(),
    getAllMatches(),
    getTagTeams(),
    supabase.auth.getUser(),
  ]);

  const board = buildEloBoard(matches, wrestlers, tagTeams);
  const elo: Record<string, { rating: number; rank: number; wins: number; losses: number }> = {};
  for (const w of wrestlers) {
    const s = board.standings.get(w.id);
    if (s) elo[w.id] = { rating: Math.round(s.rating), rank: s.rank, wins: s.wins, losses: s.losses };
  }
  const men = wrestlers.filter((w) => w.gender === "male").length;

  const withoutImages = (wrestlers ?? []).filter((w) => !w.image_url).length;

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <PageHeader
        kicker="The locker room"
        title="Roster"
        stats={[
          { label: "Wrestlers", value: wrestlers.length },
          { label: "Men", value: men },
          { label: "Women", value: wrestlers.length - men },
        ]}
        actions={
          !!user && (
            <>
              <AuditImagesButton />
              {withoutImages > 0 && <FetchImagesButton />}
            </>
          )
        }
        description={
          withoutImages > 0 && !!user ? `${withoutImages} missing photos` : undefined
        }
      />
      <WrestlerTable wrestlers={sortByName(wrestlers ?? [])} isAdmin={!!user} elo={elo} />
    </div>
  );
}
