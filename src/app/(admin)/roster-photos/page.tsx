import { createAdminClient } from "@/lib/supabase/admin";
import { PhotoReview } from "@/components/roster/photo-review";

export default async function RosterPhotosPage() {
  const manifestUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/roster-2k26/proposals.json`;
  const res = await fetch(manifestUrl, { cache: "no-store" });
  const manifest: {
    source: string;
    proposals: Array<{ id: string; name: string; proposed: string; previous: string | null }>;
    unmatched: string[];
  } | null = res.ok ? await res.json() : null;

  // Fresh (uncached) read so the review reflects what is live right now
  const { data: wrestlers } = await createAdminClient()
    .from("wrestlers")
    .select("id, image_url");
  const current = Object.fromEntries((wrestlers ?? []).map((w) => [w.id, w.image_url]));

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight">Photo Review</h1>
      {!manifest ? (
        <p className="mt-4 text-sm text-muted-foreground">No photo proposals to review.</p>
      ) : (
        <>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {manifest.proposals.length} proposed portraits from {manifest.source}. Nothing
            changes until you approve it, and every approval can be reverted to the photo
            that was there before.
          </p>
          <PhotoReview
            proposals={manifest.proposals.map((p) => ({ ...p, current: current[p.id] ?? null }))}
            unmatched={manifest.unmatched}
          />
        </>
      )}
    </div>
  );
}
