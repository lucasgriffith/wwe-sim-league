"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createTagTeam, updateTagTeam, deleteTagTeam } from "@/app/actions";
import { toast } from "sonner";

interface TagTeam {
  id: string;
  name: string;
  is_active: boolean;
  wrestler_a: { id: string; name: string; gender: string } | null;
  wrestler_b: { id: string; name: string; gender: string } | null;
}

interface Wrestler {
  id: string;
  name: string;
  gender: string;
}

export function TagTeamList({
  tagTeams,
  wrestlers,
  isAdmin = false,
}: {
  tagTeams: TagTeam[];
  wrestlers: Wrestler[];
  isAdmin?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [memberA, setMemberA] = useState("");
  const [memberB, setMemberB] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [editingTeam, setEditingTeam] = useState<TagTeam | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<TagTeam | null>(null);

  // Build set of wrestler IDs already on a tag team
  const wrestlersInTeams = new Set(
    tagTeams.flatMap((t) =>
      [t.wrestler_a?.id, t.wrestler_b?.id].filter(Boolean) as string[]
    )
  );

  const teamGender = (t: TagTeam) => t.wrestler_a?.gender ?? t.wrestler_b?.gender ?? "male";
  const maleCount = tagTeams.filter((t) => teamGender(t) === "male").length;
  const femaleCount = tagTeams.filter((t) => teamGender(t) === "female").length;

  const filtered = tagTeams.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.wrestler_a?.name.toLowerCase().includes(search.toLowerCase()) ||
      t.wrestler_b?.name.toLowerCase().includes(search.toLowerCase());
    const matchesGender =
      genderFilter === "all" || teamGender(t) === genderFilter;
    return matchesSearch && matchesGender;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!memberA || !memberB || memberA === memberB) {
      toast.error("Select two different wrestlers");
      return;
    }
    setLoading(true);
    try {
      await createTagTeam({
        name,
        wrestler_a_id: memberA,
        wrestler_b_id: memberB,
      });
      toast.success(`${name} created`);
      setName("");
      setMemberA("");
      setMemberB("");
      setShowForm(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create team"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + Create */}
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
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            { key: "all", label: `All (${tagTeams.length})` },
            { key: "male", label: `Male (${maleCount})` },
            { key: "female", label: `Female (${femaleCount})` },
          ] as const).map((g) => (
            <Button
              key={g.key}
              variant={genderFilter === g.key ? "default" : "outline"}
              size="sm"
              onClick={() => setGenderFilter(g.key)}
              className={`text-xs ${genderFilter !== g.key ? "border-border/40 text-muted-foreground hover:text-foreground" : ""}`}
            >
              {g.label}
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
                Create Tag Team
              </>
            )}
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="animate-slide-down">
          <CardContent className="pt-6">
            <form
              onSubmit={handleCreate}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <div className="flex-1 space-y-1">
                <Label>Team Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="The Shield"
                  required
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <Label>Member 1</Label>
                <Select
                  value={memberA}
                  onValueChange={(v) => setMemberA(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select wrestler...">
                      {wrestlers.find((w) => w.id === memberA)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {wrestlers.map((w) => (
                      <SelectItem
                        key={w.id}
                        value={w.id}
                        className={wrestlersInTeams.has(w.id) ? "text-muted-foreground/50" : ""}
                      >
                        {w.name}
                        {wrestlersInTeams.has(w.id) && (
                          <span className="ml-1.5 text-[10px] text-amber-400/70">⚑ in team</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <Label>Member 2</Label>
                <Select
                  value={memberB}
                  onValueChange={(v) => setMemberB(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select wrestler...">
                      {wrestlers.find((w) => w.id === memberB)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {wrestlers
                      .filter((w) => w.id !== memberA)
                      .map((w) => (
                        <SelectItem
                          key={w.id}
                          value={w.id}
                          className={wrestlersInTeams.has(w.id) ? "text-muted-foreground/50" : ""}
                        >
                          {w.name}
                          {wrestlersInTeams.has(w.id) && (
                            <span className="ml-1.5 text-[10px] text-amber-400/70">⚑ in team</span>
                          )}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gold text-black hover:bg-gold-dark font-semibold"
              >
                {loading ? "Creating..." : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tag Team Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((team) => (
          <Card
            key={team.id}
            className="group transition-colors hover:border-border/60"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{team.name}</CardTitle>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      team.is_active
                        ? "border-emerald-500/20 text-emerald-400"
                        : "border-muted-foreground/20 text-muted-foreground"
                    }`}
                  >
                    {team.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {isAdmin && (
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingTeam(team)}
                        title="Edit"
                      >
                        <svg
                          width="13"
                          height="13"
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
                        onClick={() => setDeletingTeam(team)}
                        title="Delete"
                      >
                        <svg
                          width="13"
                          height="13"
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
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TeamGenderBadge team={team} />
                <p className="text-sm text-muted-foreground">
                  {team.wrestler_a?.name ?? "?"} &{" "}
                  {team.wrestler_b?.name ?? "?"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">
            {tagTeams.length === 0
              ? "No tag teams created yet"
              : "No teams match your search"}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground/60">
        Showing {filtered.length} of {tagTeams.length}
      </p>

      {/* Edit Dialog */}
      {editingTeam && (
        <EditTagTeamDialog
          team={editingTeam}
          wrestlers={wrestlers}
          wrestlersInTeams={wrestlersInTeams}
          onClose={() => setEditingTeam(null)}
        />
      )}

      {/* Delete Dialog */}
      {deletingTeam && (
        <DeleteTagTeamDialog
          team={deletingTeam}
          onClose={() => setDeletingTeam(null)}
        />
      )}
    </div>
  );
}

/* ─── Gender Badge ────────────────────────────────────────────────── */

function TeamGenderBadge({ team }: { team: TagTeam }) {
  const genderA = team.wrestler_a?.gender;
  const genderB = team.wrestler_b?.gender;

  // Determine team gender: both male = male, both female = female, mixed = mixed
  const teamGender =
    genderA === genderB
      ? genderA === "male"
        ? "male"
        : "female"
      : "mixed";

  const config = {
    male: { label: "Male", className: "border-blue-500/20 text-blue-400" },
    female: { label: "Female", className: "border-purple-500/20 text-purple-400" },
    mixed: { label: "Mixed", className: "border-amber-500/20 text-amber-400" },
  };

  const { label, className } = config[teamGender];

  return (
    <Badge variant="outline" className={`text-[10px] ${className}`}>
      {label}
    </Badge>
  );
}

/* ─── Edit Dialog ─────────────────────────────────────────────────── */

function EditTagTeamDialog({
  team,
  wrestlers,
  wrestlersInTeams,
  onClose,
}: {
  team: TagTeam;
  wrestlers: Wrestler[];
  wrestlersInTeams: Set<string>;
  onClose: () => void;
}) {
  // Wrestlers currently in THIS team should not show as "in team"
  const currentTeamIds = new Set(
    [team.wrestler_a?.id, team.wrestler_b?.id].filter(Boolean) as string[]
  );
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(team.name);
  const [memberA, setMemberA] = useState(team.wrestler_a?.id ?? "");
  const [memberB, setMemberB] = useState(team.wrestler_b?.id ?? "");
  const [isActive, setIsActive] = useState(team.is_active);

  function handleSave() {
    if (!memberA || !memberB || memberA === memberB) {
      toast.error("Select two different wrestlers");
      return;
    }
    startTransition(async () => {
      try {
        await updateTagTeam(team.id, {
          name,
          wrestler_a_id: memberA,
          wrestler_b_id: memberB,
          is_active: isActive,
        });
        toast.success(`${name} updated`);
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update team"
        );
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Tag Team</DialogTitle>
          <DialogDescription>Update {team.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-team-name">Team Name</Label>
            <Input
              id="edit-team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Member 1</Label>
            <Select value={memberA} onValueChange={(v) => setMemberA(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select wrestler...">
                  {wrestlers.find((w) => w.id === memberA)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {wrestlers.map((w) => {
                  const inOtherTeam = wrestlersInTeams.has(w.id) && !currentTeamIds.has(w.id);
                  return (
                    <SelectItem
                      key={w.id}
                      value={w.id}
                      className={inOtherTeam ? "text-muted-foreground/50" : ""}
                    >
                      {w.name}
                      {inOtherTeam && (
                        <span className="ml-1.5 text-[10px] text-amber-400/70">⚑ in team</span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Member 2</Label>
            <Select value={memberB} onValueChange={(v) => setMemberB(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select wrestler...">
                  {wrestlers.find((w) => w.id === memberB)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {wrestlers
                  .filter((w) => w.id !== memberA)
                  .map((w) => {
                    const inOtherTeam = wrestlersInTeams.has(w.id) && !currentTeamIds.has(w.id);
                    return (
                      <SelectItem
                        key={w.id}
                        value={w.id}
                        className={inOtherTeam ? "text-muted-foreground/50" : ""}
                      >
                        {w.name}
                        {inOtherTeam && (
                          <span className="ml-1.5 text-[10px] text-amber-400/70">⚑ in team</span>
                        )}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
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

/* ─── Delete Dialog ───────────────────────────────────────────────── */

function DeleteTagTeamDialog({
  team,
  onClose,
}: {
  team: TagTeam;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteTagTeam(team.id);
        toast.success(`${team.name} deleted`);
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete team"
        );
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Tag Team</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{team.name}</span>?
            This action cannot be undone.
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
