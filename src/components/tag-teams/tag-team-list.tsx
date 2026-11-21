"use client";

import Link from "next/link";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
  wrestler_a: { id: string; name: string; gender: string; image_url?: string | null } | null;
  wrestler_b: { id: string; name: string; gender: string; image_url?: string | null } | null;
}

interface Wrestler {
  id: string;
  name: string;
  gender: string;
}

/** Everything the wall shows about a team beyond its name and members */
export interface TeamInfo {
  rating: number;
  /** Elo rank in the men's or women's tag pool; null until they have wrestled */
  rank: number | null;
  wins: number;
  losses: number;
  tierId: string | null;
  /** 1-based place in the pool (or the whole table when the title has no pools) */
  place: number | null;
  pool: string | null;
  placeLabel: string | null;
  zone: "playoff" | "wildcard" | "cage" | "drop" | null;
  champion: string | null;
  /** Matches on record, all seasons */
  matches: number;
}

export interface WallTier {
  id: string;
  href: string;
  name: string;
  tierNumber: number;
  women: boolean;
  bg: string;
  fg: string;
  progress: string;
}

type Sort = "tier" | "elo" | "name";

const ZONE_STRIPE = {
  playoff: "border-l-gold",
  wildcard: "border-l-gold/50",
  cage: "border-l-amber-500",
  drop: "border-l-red-500",
} as const;

export function TagTeamList({
  tagTeams,
  wrestlers,
  info,
  tiers,
  isAdmin = false,
}: {
  tagTeams: TagTeam[];
  wrestlers: Wrestler[];
  info: Record<string, TeamInfo>;
  tiers: WallTier[];
  isAdmin?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [memberA, setMemberA] = useState("");
  const [memberB, setMemberB] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [sort, setSort] = useState<Sort>("tier");
  const [editingTeam, setEditingTeam] = useState<TagTeam | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<TagTeam | null>(null);

  // Build set of wrestler IDs already on a tag team
  const wrestlersInTeams = new Set(
    tagTeams.flatMap((t) =>
      [t.wrestler_a?.id, t.wrestler_b?.id].filter(Boolean) as string[]
    )
  );

  const teamGender = (t: TagTeam) => t.wrestler_a?.gender ?? t.wrestler_b?.gender ?? "male";

  const q = search.trim().toLowerCase();
  const filtered = tagTeams.filter((t) => {
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.wrestler_a?.name.toLowerCase().includes(q) ||
      t.wrestler_b?.name.toLowerCase().includes(q);
    const matchesGender = genderFilter === "all" || teamGender(t) === genderFilter;
    return matchesSearch && matchesGender;
  });

  const byElo = (a: TagTeam, b: TagTeam) =>
    (info[b.id]?.rating ?? 0) - (info[a.id]?.rating ?? 0) || a.name.localeCompare(b.name);

  // Grouped by championship, in table order; teams without a place go last
  type Pool = { label: string | null; teams: TagTeam[] };
  const groups: Array<{ tier: WallTier | null; pools: Pool[] }> = [];
  if (sort === "tier") {
    for (const tier of tiers) {
      const teams = filtered
        .filter((t) => info[t.id]?.tierId === tier.id)
        .sort((a, b) => (info[a.id]?.place ?? 99) - (info[b.id]?.place ?? 99));
      if (teams.length === 0) continue;
      const labels = [...new Set(teams.map((t) => info[t.id]?.pool ?? null))].sort((a, b) =>
        (a ?? "").localeCompare(b ?? "")
      );
      groups.push({
        tier,
        pools: labels.map((label) => ({
          label,
          teams: teams.filter((t) => (info[t.id]?.pool ?? null) === label),
        })),
      });
    }
    const known = new Set(tiers.map((t) => t.id));
    const rest = filtered.filter((t) => !known.has(info[t.id]?.tierId ?? ""));
    if (rest.length > 0) groups.push({ tier: null, pools: [{ label: null, teams: rest }] });
  } else {
    groups.push({
      tier: null,
      pools: [{ label: null, teams: sort === "elo" ? [...filtered].sort(byElo) : filtered }],
    });
  }

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
            placeholder="Search teams or members"
            aria-label="Search teams or members"
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
            {(["tier", "elo", "name"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setSort(k)} className={`${pill(sort === k)} -ml-px first:ml-0`}>
                {k === "tier" ? "Title" : k === "elo" ? "Elo" : "A–Z"}
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
            {showForm ? "Cancel" : "+ Create Tag Team"}
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
                          <span className="ml-1.5 text-[10px] text-amber-400/70">in team</span>
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
                            <span className="ml-1.5 text-[10px] text-amber-400/70">in team</span>
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

      {filtered.length === 0 ? (
        <div className="halftone border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <h3 className="text-2xl">
            {tagTeams.length === 0 ? "No tag teams yet" : "No teams found"}
          </h3>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group, gi) => (
            <section key={group.tier?.id ?? `rest-${gi}`}>
              {group.tier ? (
                <Link
                  href={group.tier.href}
                  className="group/plate mb-px flex items-stretch border border-border bg-card"
                >
                  <span
                    className="flex shrink-0 items-center px-3 font-display text-xl font-black leading-none"
                    style={{ background: group.tier.bg, color: group.tier.fg }}
                  >
                    T{group.tier.tierNumber}
                  </span>
                  <span className="min-w-0 flex-1 px-3 py-2">
                    <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                      {group.tier.women ? "Women's tag" : "Men's tag"} · {group.tier.progress}
                    </span>
                    <span className="block truncate font-display text-xl font-extrabold leading-tight group-hover/plate:text-gold">
                      {group.tier.name}
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground group-hover/plate:text-gold sm:flex">
                    Standings →
                  </span>
                </Link>
              ) : (
                sort === "tier" && (
                  <div className="rule-title mb-3">
                    <h2 className="text-xl">Not in a championship this season</h2>
                  </div>
                )
              )}
              {group.pools.map((pool) => (
                <div key={pool.label ?? "all"}>
                  {pool.label && (
                    <p className="px-1 pb-1.5 pt-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                      Pool {pool.label}
                    </p>
                  )}
                  <div className="grid grid-cols-1 pl-px pt-px sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {pool.teams.map((team) => (
                      <TeamTile
                        key={team.id}
                        team={team}
                        info={info[team.id]}
                        showPlace={sort === "tier" && !!group.tier}
                        tier={tiers.find((t) => t.id === info[team.id]?.tierId) ?? null}
                        isAdmin={isAdmin}
                        onEdit={() => setEditingTeam(team)}
                        onDelete={() => setDeletingTeam(team)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">
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
          matches={info[deletingTeam.id]?.matches ?? 0}
          onClose={() => setDeletingTeam(null)}
        />
      )}
    </div>
  );
}

/* ─── Team tile ───────────────────────────────────────────────────── */

function TeamTile({
  team,
  info,
  tier,
  showPlace,
  isAdmin,
  onEdit,
  onDelete,
}: {
  team: TagTeam;
  info: TeamInfo | undefined;
  tier: WallTier | null;
  /** Grouped by title: lead with the place in the table rather than the title */
  showPlace: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const members = [team.wrestler_a, team.wrestler_b];
  const stripe = showPlace && info?.zone ? ZONE_STRIPE[info.zone] : "border-l-transparent";

  return (
    <div
      className={`group relative -ml-px -mt-px border border-border bg-card ${team.is_active ? "" : "opacity-45"}`}
    >
      <Link href={`/tag-teams/${team.id}`} className="block">
        <div className="halftone relative flex aspect-[2/1] overflow-hidden bg-background">
          {members.map((m, i) => (
            <div key={i} className="relative h-full w-1/2 overflow-hidden">
              {m?.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={m.image_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-6xl font-black text-muted-foreground/15">
                  {m?.name.charAt(0) ?? "?"}
                </div>
              )}
            </div>
          ))}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-card to-transparent" />
          {info?.rank != null && info.rank <= 10 && (
            <span
              className="absolute left-0 top-0 bg-gold px-1.5 py-0.5 font-display text-lg font-black leading-none text-black tabular-nums"
              title={`Ranked #${info.rank} by Elo`}
            >
              #{info.rank}
            </span>
          )}
          {info?.champion && (
            <span className="absolute right-0 top-0 bg-gold px-1.5 py-1 font-mono text-[9px] font-bold uppercase leading-none tracking-[0.16em] text-black">
              Champions
            </span>
          )}
          {!team.is_active && (
            <span className="absolute bottom-1 right-1 font-mono text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
              Inactive
            </span>
          )}
        </div>
        <div className={`border-l-[3px] border-t-2 border-t-transparent px-3 pb-3 pt-2 transition-colors group-hover:border-t-gold ${stripe}`}>
          <div className="flex items-baseline gap-2">
            {showPlace && info?.place != null && (
              <span className="shrink-0 font-display text-xl font-black leading-none tabular-nums text-muted-foreground">
                {info.place}
              </span>
            )}
            <span className="min-w-0 font-display text-xl font-extrabold leading-[1.05] [overflow-wrap:anywhere] group-hover:text-gold">
              {team.name}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {team.wrestler_a?.name ?? "?"} &amp; {team.wrestler_b?.name ?? "?"}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[10px]">
            <span className="flex items-baseline gap-2">
              <span className="font-bold text-gold tabular-nums">{info?.rating ?? "—"}</span>
              <span className="tabular-nums text-muted-foreground">
                {info ? `${info.wins}-${info.losses}` : "0-0"}
              </span>
            </span>
            {showPlace ? (
              info?.zone && (
                <span
                  className={`uppercase tracking-[0.14em] ${
                    info.zone === "playoff" || info.zone === "wildcard"
                      ? "text-gold"
                      : info.zone === "cage"
                        ? "text-amber-500"
                        : "text-red-400"
                  }`}
                >
                  {info.zone === "playoff"
                    ? "Playoff place"
                    : info.zone === "wildcard"
                      ? "Wild card"
                      : info.zone === "cage"
                        ? "Steel cage"
                        : "Drop zone"}
                </span>
              )
            ) : tier ? (
              <span className="flex min-w-0 items-center gap-1.5 uppercase tracking-[0.12em] text-muted-foreground">
                <span className="h-2 w-2 shrink-0" style={{ background: tier.bg }} />
                <span className="truncate">
                  T{tier.tierNumber} · {info?.placeLabel}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      {isAdmin && (
        <div className="absolute right-1 top-7 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            title="Edit"
            aria-label={`Edit ${team.name}`}
            className="flex h-7 w-7 items-center justify-center bg-background/90 text-muted-foreground hover:text-gold"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            aria-label={`Delete ${team.name}`}
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
                        <span className="ml-1.5 text-[10px] text-amber-400/70">in team</span>
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
                          <span className="ml-1.5 text-[10px] text-amber-400/70">in team</span>
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
  matches,
  onClose,
}: {
  team: TagTeam;
  /** Matches on record that would be deleted with the team */
  matches: number;
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
          {matches > 0 && (
            <p className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              This also deletes their {matches} {matches === 1 ? "match" : "matches"} and
              season placements, which changes opponents&apos; records and ratings. To
              retire a team and keep its history, edit it and set it to Inactive.
            </p>
          )}
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
