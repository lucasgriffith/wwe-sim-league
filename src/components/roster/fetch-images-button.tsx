"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fetchAllWrestlerImages } from "@/app/actions";
import { toast } from "sonner";

export function FetchImagesButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleFetch() {
    setLoading(true);
    try {
      const result = await fetchAllWrestlerImages();
      if (result.updated > 0) {
        toast.success(
          `Found images for ${result.updated} of ${result.total} wrestlers`
        );
      } else {
        toast.info(
          result.total === 0
            ? "All wrestlers already have images"
            : `No images found for ${result.total} wrestlers — try adding them manually`
        );
      }
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch images"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleFetch}
      disabled={loading}
      className="gap-1.5 text-xs border-border/40 text-muted-foreground hover:text-foreground"
    >
      {loading ? (
        <>
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-20" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          Fetching...
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Fetch Images
        </>
      )}
    </Button>
  );
}
