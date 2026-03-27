"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateTierBeltImage } from "@/app/actions";
import { toast } from "sonner";

export function BeltImageEditor({
  tierId,
  currentUrl,
}: {
  tierId: string;
  currentUrl: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(currentUrl ?? "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (!url.trim()) return;
    setLoading(true);
    try {
      await updateTierBeltImage(tierId, url.trim());
      toast.success("Belt image updated");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setEditing(true)}
        className="text-[10px] text-muted-foreground/50 hover:text-foreground h-6 px-2"
      >
        {currentUrl ? "Edit Belt Image" : "Add Belt Image"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste belt image URL..."
        className="h-7 text-xs bg-background/50"
      />
      <Button
        size="sm"
        onClick={handleSave}
        disabled={loading || !url.trim()}
        className="h-7 text-xs bg-gold text-black hover:bg-gold-dark"
      >
        {loading ? "..." : "Save"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { setEditing(false); setUrl(currentUrl ?? ""); }}
        className="h-7 text-xs"
      >
        Cancel
      </Button>
    </div>
  );
}
