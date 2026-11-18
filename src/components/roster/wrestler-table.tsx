"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Database } from "@/types/database";
import type { Gender } from "@/types/database";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WrestlerForm } from "./wrestler-form";
import { ImageUpload } from "@/components/ui/image-upload";
import { updateWrestler, deleteWrestler } from "@/app/actions";
import { toast } from "sonner";

type Wrestler = Database["public"]["Tables"]["wrestlers"]["Row"];

export function WrestlerTable({
  wrestlers,
  isAdmin = false,
  elo = {},
}: {
  wrestlers: Wrestler[];
  isAdmin?: boolean;
  elo?: Record<string, { rating: number; rank: number; wins: number; losses: number }>;
}) {
  const [sort, setSort] = useState<"name" | "elo" | "ovr">("name");
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">(
    "all"
  );
  const [showForm, setShowForm] = useState(false);
  const [editingWrestler, setEditingWrestler] = useState<Wrestler | null>(null);
  const [deletingWrestler, setDeletingWrestler] = useState<Wrestler | null>(
    null
  );

  const filtered = wrestlers
    .filter((w) => {
      const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase());
      const matchesGender = genderFilter === "all" || w.gender === genderFilter;
      return matchesSearch && matchesGender;
    })
    .sort((a, b) => {
      if (sort === "elo") {
        return (elo[b.id]?.rating ?? 0) - (elo[a.id]?.rating ?? 0);
      }
      if (sort === "ovr") {
        return (b.overall_rating ?? 0) - (a.overall_rating ?? 0);
      }
      return 0;
    });

  const pill = (active: boolean) =>
    `h-8 px-3 font-mono text-[10px] uppercase tracking-[0.16em] border transition-colors ${
      active
        ? "border-gold bg-gold text-black font-bold"
        : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
    }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <Input
            placeholder="Search the roster"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex">
            {(["all", "male", "female"] as const).map((g) => (
              <button key={g} type="button" onClick={() => setGenderFilter(g)} className={`${pill(genderFilter === g)} -ml-px first:ml-0`}>
                {g === "all" ? "All" : g === "male" ? "Men" : "Women"}
              </button>
            ))}
          </div>
          <div className="flex items-center">
            <span className="mr-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">Sort</span>
            {(["name", "elo", "ovr"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setSort(k)} className={`${pill(sort === k)} -ml-px first:ml-0`}>
                {k === "name" ? "A–Z" : k === "elo" ? "Elo" : "Overall"}
              </button>
            ))}
          </div>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            className="bg-gold text-black hover:bg-gold-dark font-semibold text-xs gap-1.5 lg:ml-auto"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Cancel" : "+ Add Wrestler"}
          </Button>
        )}
      </div>

      {showForm && (
        <div className="animate-slide-down">
          <WrestlerForm onSuccess={() => setShowForm(false)} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="halftone border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <h3 className="text-2xl">No wrestlers found</h3>
        </div>
      ) : (
        <div className="grid grid-cols-2 pl-px pt-px sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((wrestler) => {
            const e = elo[wrestler.id];
            return (
              <div
                key={wrestler.id}
                className={`group relative -ml-px -mt-px border border-border bg-card ${wrestler.is_active ? "" : "opacity-45"}`}
              >
                <Link href={`/roster/${wrestler.slug ?? wrestler.id}`} className="block">
                  <div className="halftone relative aspect-square overflow-hidden bg-background">
                    {wrestler.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={wrestler.image_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-7xl font-black text-muted-foreground/15">
                        {wrestler.name.charAt(0)}
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-card to-transparent" />
                    {e && e.rank <= 25 && (
                      <span className="absolute left-0 top-0 bg-gold px-1.5 py-0.5 font-display text-lg font-black leading-none text-black tabular-nums">
                        #{e.rank}
                      </span>
                    )}
                    {wrestler.overall_rating != null && (
                      <span className="absolute right-0 top-0 bg-background/85 px-1.5 py-1 font-mono text-[10px] font-bold leading-none text-foreground/90">
                        {wrestler.overall_rating}
                        <span className="ml-0.5 text-[8px] text-muted-foreground">OVR</span>
                      </span>
                    )}
                    {!wrestler.is_active && (
                      <span className="absolute bottom-1 right-1 font-mono text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="border-t-2 border-transparent px-2.5 pb-2.5 pt-2 transition-colors group-hover:border-gold">
                    <div className="font-display text-lg font-extrabold leading-[1.02] [overflow-wrap:anywhere] group-hover:text-gold">
                      {wrestler.name}
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between gap-2 font-mono text-[10px]">
                      {e ? (
                        <>
                          <span className="font-bold text-gold">{e.rating}</span>
                          <span className="text-muted-foreground">
                            {e.wins}-{e.losses}
                          </span>
                        </>
                      ) : (
                        <span className="uppercase tracking-[0.14em] text-muted-foreground/50">
                          {wrestler.gender === "male" ? "Men" : "Women"} · unranked
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                {isAdmin && (
                  <div className="absolute right-1 top-7 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => setEditingWrestler(wrestler)}
                      title="Edit"
                      aria-label={`Edit ${wrestler.name}`}
                      className="flex h-7 w-7 items-center justify-center bg-background/90 text-muted-foreground hover:text-gold"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingWrestler(wrestler)}
                      title="Delete"
                      aria-label={`Delete ${wrestler.name}`}
                      className="flex h-7 w-7 items-center justify-center bg-background/90 text-muted-foreground hover:text-red-400"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">
        Showing {filtered.length} of {wrestlers.length}
      </p>

      {/* Edit Dialog */}
      {editingWrestler && (
        <EditWrestlerDialog
          wrestler={editingWrestler}
          onClose={() => setEditingWrestler(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingWrestler && (
        <DeleteWrestlerDialog
          wrestler={deletingWrestler}
          onClose={() => setDeletingWrestler(null)}
        />
      )}
    </div>
  );
}

/* ─── Edit Dialog ─────────────────────────────────────────────────── */

function EditWrestlerDialog({
  wrestler,
  onClose,
}: {
  wrestler: Wrestler;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(wrestler.name);
  const [gender, setGender] = useState<Gender>(wrestler.gender);
  const [brand, setBrand] = useState(wrestler.brand ?? "");
  const [overallRating, setOverallRating] = useState(
    wrestler.overall_rating?.toString() ?? ""
  );
  const [isActive, setIsActive] = useState(wrestler.is_active);
  const [imageUrl, setImageUrl] = useState(wrestler.image_url ?? "");

  function handleSave() {
    startTransition(async () => {
      try {
        await updateWrestler(wrestler.id, {
          name,
          gender,
          brand: brand || undefined,
          overall_rating: overallRating ? parseInt(overallRating) : undefined,
          is_active: isActive,
          image_url: imageUrl || undefined,
        });
        toast.success(`${name} updated`);
        onClose();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update wrestler"
        );
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Wrestler</DialogTitle>
          <DialogDescription>
            Update {wrestler.name}&apos;s details
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-1.5">
            <Label>Photo</Label>
            <ImageUpload
              folder="wrestlers"
              currentUrl={imageUrl || null}
              onUpload={(url) => setImageUrl(url)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select
                value={gender}
                onValueChange={(v) => setGender(v as Gender)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-brand">Brand</Label>
              <Input
                id="edit-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Raw, SD..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-overall">Overall Rating</Label>
              <Input
                id="edit-overall"
                type="number"
                min={0}
                max={100}
                value={overallRating}
                onChange={(e) => setOverallRating(e.target.value)}
                placeholder="85"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={isActive ? "active" : "inactive"}
                onValueChange={(v) => setIsActive(v === "active")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="bg-gold text-black hover:bg-gold-dark font-semibold"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Delete Confirmation Dialog ──────────────────────────────────── */

function DeleteWrestlerDialog({
  wrestler,
  onClose,
}: {
  wrestler: Wrestler;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteWrestler(wrestler.id);
        toast.success(`${wrestler.name} removed from roster`);
        onClose();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete wrestler"
        );
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Wrestler</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove{" "}
            <span className="font-semibold text-foreground">
              {wrestler.name}
            </span>{" "}
            from the roster? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
