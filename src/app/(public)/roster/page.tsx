import { createClient } from "@/lib/supabase/server";
import { WrestlerTable } from "@/components/roster/wrestler-table";

export default async function RosterPage() {
  const supabase = await createClient();

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("*")
    .order("name");

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roster</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {wrestlers?.length ?? 0} wrestlers
          </p>
        </div>
      </div>
      <WrestlerTable wrestlers={wrestlers ?? []} />
    </div>
  );
}
