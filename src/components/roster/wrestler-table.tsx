"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Database } from "@/types/database";
import type { Gender } from "@/types/database";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { updateWrestler, deleteWrestler } from "@/app/actions";
import { toast } from "sonner";

type Wrestler = Database["public"]["Tables"]["wrestlers"]["Row"];

export function WrestlerTable({
  wrestlers,
  isAdmin = false,
}: {
  wrestlers: Wrestler[];
  isAdmin?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">(
    "all"
  );
  const [showForm, setShowForm] = useState(false);
  const [editingWrestler, setEditingWrestler] = useState<Wrestler | null>(null);
  const [deletingWrestler, setDeletingWrestler] = useState<Wrestler | null>(
    null
  );

  const filtered = wrestlers.filter((w) => {
    const matchesSearch = w.name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesGender =
      genderFilter === "all" || w.gender === genderFilter;
    return matchesSearch && matchesGender;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
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
            placeholder="Search wrestlers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "male", "female"] as const).map((g) => (
            <Button
              key={g}
              variant={genderFilter === g ? "default" : "outline"}
              size="sm"
              onClick={() => setGenderFilter(g)}
              className={`text-xs ${genderFilter !== g ? "border-border/40 text-muted-foreground hover:text-foreground" : ""}`}
            >
              {g === "all" ? "All" : g === "male" ? "Male" : "Female"}
            </Button>
          ))}
        </div>
        {isAdmin && (
          <Button
            size="sm"
            className="ml-auto bg-gold text-black hover:bg-gold-dark font-semibold text-xs gap-1.5"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? (
              "Cancel"
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Wrestler
              </>
            )}
          </Button>
        )}
      </div>

      {showForm && (
        <div className="animate-slide-down">
          <WrestlerForm onSuccess={() => setShowForm(false)} />
        </div>
      )}

      <div className="rounded-lg border border-border/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="text-[11px] uppercase tracking-wider">
                Name
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">
                Gender
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">
                Brand
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">
                Overall
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">
                Status
              </TableHead>
              {isAdmin && (
                <TableHead className="text-[11px] uppercase tracking-wider text-right">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((wrestler) => (
              <TableRow
                key={wrestler.id}
                className="table-row-hover border-border/30"
              >
                <TableCell>
                  <Link
                    href={`/roster/${wrestler.slug ?? wrestler.id}`}
                    className="flex items-center gap-2.5 font-medium hover:text-gold transition-colors"
                  >
                    {wrestler.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={wrestler.image_url}
                        alt={wrestler.name}
                        className="h-7 w-7 rounded-full object-cover border border-border/30 shrink-0"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted/30 border border-border/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-muted-foreground/40">
                          {wrestler.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    {wrestler.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      wrestler.gender === "male"
                        ? "border-blue-500/20 text-blue-400"
                        : "border-purple-500/20 text-purple-400"
                    }`}
                  >
                    {wrestler.gender === "male" ? "Male" : "Female"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {wrestler.brand || (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums font-medium">
                  {wrestler.overall_rating ?? (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`status-dot ${wrestler.is_active ? "status-dot-active" : "status-dot-inactive"}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {wrestler.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingWrestler(wrestler)}
                        title="Edit"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                        onClick={() => setDeletingWrestler(wrestler)}
                        title="Delete"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 5}
                  className="text-center text-muted-foreground py-8"
                >
                  No wrestlers found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground/60">
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

  function handleSave() {
    startTransition(async () => {
      try {
        await updateWrestler(wrestler.id, {
          name,
          gender,
          brand: brand || undefined,
          overall_rating: overallRating ? parseInt(overallRating) : undefined,
          is_active: isActive,
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
