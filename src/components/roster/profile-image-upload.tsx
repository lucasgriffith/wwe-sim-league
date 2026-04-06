"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/ui/image-upload";
import { updateWrestler } from "@/app/actions";
import { toast } from "sonner";

export function ProfileImageUpload({
  wrestlerId,
  currentUrl,
}: {
  wrestlerId: string;
  currentUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleUpload(url: string) {
    startTransition(async () => {
      try {
        await updateWrestler(wrestlerId, { image_url: url });
        toast.success("Photo updated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update photo");
      }
    });
  }

  return (
    <div className={`mt-2 ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
      <ImageUpload
        folder="wrestlers"
        currentUrl={currentUrl}
        onUpload={handleUpload}
      />
    </div>
  );
}
