import { createClient } from "@/lib/supabase/server";
import { WrestlerTable } from "@/components/roster/wrestler-table";
import { FetchImagesButton } from "@/components/roster/fetch-images-button";

export default async function RosterPage() {
  const supabase = await createClient();

  const [{ data: wrestlers }, { data: { user } }] = await Promise.all([
    supabase.from("wrestlers").select("*").order("name"),
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
        {!!user && withoutImages > 0 && <FetchImagesButton />}
      </div>
      <WrestlerTable wrestlers={wrestlers ?? []} isAdmin={!!user} />
    </div>
  );
}
