import { createClient } from "@/lib/supabase/server";
import { getWrestlers } from "@/lib/data/cached";
import { WrestlerTable } from "@/components/roster/wrestler-table";
import { FetchImagesButton } from "@/components/roster/fetch-images-button";
import { AuditImagesButton } from "@/components/roster/audit-images-button";
import { sortByName } from "@/lib/utils/sort-name";

export default async function RosterPage() {
  const supabase = await createClient();

  const [wrestlers, { data: { user } }] = await Promise.all([
    getWrestlers(),
    supabase.auth.getUser(),
  ]);

  const withoutImages = (wrestlers ?? []).filter((w) => !w.image_url).length;

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roster</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {wrestlers?.length ?? 0} wrestlers
            {withoutImages > 0 && !!user && (
              <span className="text-muted-foreground/40"> · {withoutImages} missing photos</span>
            )}
          </p>
        </div>
        {!!user && (
          <div className="flex items-center gap-2">
            <AuditImagesButton />
            {withoutImages > 0 && <FetchImagesButton />}
          </div>
        )}
      </div>
      <WrestlerTable wrestlers={sortByName(wrestlers ?? [])} isAdmin={!!user} />
    </div>
  );
}
