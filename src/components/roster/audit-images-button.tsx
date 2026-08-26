"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auditWrestlerImages } from "@/app/actions";
import { toast } from "sonner";

export function AuditImagesButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAudit() {
    setLoading(true);
    try {
      const result = await auditWrestlerImages();
      if (result.cleared.length > 0) {
        toast.warning(
          `Cleared ${result.cleared.length} broken photo${result.cleared.length === 1 ? "" : "s"}: ${result.cleared.slice(0, 4).join(", ")}${result.cleared.length > 4 ? "…" : ""} — run Fetch Images to replace them`,
          { duration: 8000 }
        );
      } else {
        toast.success(`All ${result.checked} photos check out`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleAudit}
      disabled={loading}
      className="gap-1.5 text-xs border-border/40 text-muted-foreground hover:text-foreground"
      title="Check every photo still exists on Wikimedia and clear the broken ones"
    >
      {loading ? (
        <>
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-20" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          Auditing...
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Audit Photos
        </>
      )}
    </Button>
  );
}
