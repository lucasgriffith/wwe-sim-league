"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  revalidatePath as nextRevalidatePath,
  updateTag,
} from "next/cache";
import { LEAGUE_TAG } from "@/lib/data/cached";
import type {
  Gender,
  SeasonStatus,
  PoolLabel,
  MatchPhase,
} from "@/types/database";

// Every mutation in this file calls revalidatePath at least once; routing it
// through this wrapper also busts the shared cached-data layer (LEAGUE_TAG)
// with read-your-writes semantics, so the admin sees their change immediately.
function revalidatePath(path: string) {
  updateTag(LEAGUE_TAG);
  nextRevalidatePath(path);
}

// ─── Wrestler actions ───────────────────────────────────────────────────────

export async function createWrestler(data: {
  name: string;
  gender: Gender;
  brand?: string;
  overall_rating?: number;
  image_url?: string;
}) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("wrestlers").insert({
    name: data.name,
    gender: data.gender,
    brand: data.brand || null,
    overall_rating: data.overall_rating || null,
    image_url: data.image_url || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/roster");
}

export async function updateWrestler(
  id: string,
  data: {
    name?: string;
    gender?: Gender;
    brand?: string | null;
    overall_rating?: number | null;
    image_url?: string | null;
    is_active?: boolean;
  }
) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("wrestlers")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/roster");
  revalidatePath(`/roster/${id}`);
}

export async function deleteWrestler(id: string) {
  await requireAdmin();
  const admin = createAdminClient();

  // Deleting a wrestler with history would either fail on FK constraints or
  // destroy match records — steer toward deactivation instead.
  const { count: matchCount } = await admin
    .from("matches")
    .select("id", { count: "exact", head: true })
    .or(`wrestler_a_id.eq.${id},wrestler_b_id.eq.${id}`);
  if ((matchCount ?? 0) > 0) {
    throw new Error(
      "This wrestler has match history. Set them inactive instead of deleting."
    );
  }
  const { count: teamCount } = await admin
    .from("tag_teams")
    .select("id", { count: "exact", head: true })
    .or(`wrestler_a_id.eq.${id},wrestler_b_id.eq.${id}`);
  if ((teamCount ?? 0) > 0) {
    throw new Error(
      "This wrestler belongs to a tag team. Remove or delete the team first."
    );
  }

  // Setup-time tier assignments with no matches are safe to clear
  const { error: assignErr } = await admin
    .from("tier_assignments")
    .delete()
    .eq("wrestler_id", id);
  if (assignErr) throw new Error(assignErr.message);

  const { error } = await admin.from("wrestlers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/roster");
}

// ─── Tag Team actions ───────────────────────────────────────────────────────

export async function createTagTeam(data: {
  name: string;
  wrestler_a_id: string;
  wrestler_b_id: string;
}) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("tag_teams").insert(data);
  if (error) throw new Error(error.message);
  revalidatePath("/tag-teams");
}

export async function updateTagTeam(
  id: string,
  data: {
    name?: string;
    wrestler_a_id?: string;
    wrestler_b_id?: string;
    is_active?: boolean;
  }
) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("tag_teams").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tag-teams");
}

export async function deleteTagTeam(id: string) {
  await requireAdmin();
  const admin = createAdminClient();

  // Remove any tier assignments referencing this tag team first
  await admin.from("tier_assignments").delete().eq("tag_team_id", id);

  // Remove any matches referencing this tag team
  await admin.from("matches").delete().eq("tag_team_a_id", id);
  await admin.from("matches").delete().eq("tag_team_b_id", id);

  // Remove any relegation events
  await admin.from("relegation_events").delete().eq("tag_team_id", id);

  const { error } = await admin.from("tag_teams").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tag-teams");
  revalidatePath("/season/setup");
  revalidatePath("/tiers");
}

// ─── Season actions ─────────────────────────────────────────────────────────

export async function createSeason(seasonNumber: number) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("seasons")
    .insert({ season_number: seasonNumber })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/season");
  return data;
}

export async function advanceSeasonStatus(
  seasonId: string,
  newStatus: SeasonStatus
) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("advance_season_status", {
    p_season_id: seasonId,
    p_new_status: newStatus,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/season");
}

/**
 * Start the season: fetch FRESH assignments from DB, generate round-robin
 * schedules, create match records, then advance status to pool_play.
 */
export async function startSeason(seasonId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  // Idempotency guard: only a season in setup with no matches can start.
  // Prevents double-generating the round robin from a stale page or second tab.
  const { data: season, error: seasonErr } = await admin
    .from("seasons")
    .select("status")
    .eq("id", seasonId)
    .single();
  if (seasonErr) throw new Error(seasonErr.message);
  if (season.status !== "setup") {
    throw new Error(`Season already started (status: ${season.status})`);
  }
  const { count: existingCount } = await admin
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId);
  if ((existingCount ?? 0) > 0) {
    throw new Error(
      "This season already has matches. Reset assignments first to regenerate."
    );
  }

  // Fetch fresh assignments from database (not stale props!)
  const { data: assignments, error: assignErr } = await admin
    .from("tier_assignments")
    .select("tier_id, wrestler_id, tag_team_id, pool")
    .eq("season_id", seasonId);
  if (assignErr) throw new Error(assignErr.message);

  // Fetch tiers
  const { data: tiers, error: tierErr } = await admin
    .from("tiers")
    .select("id, has_pools, divisions(division_type)")
    .order("tier_number");
  if (tierErr) throw new Error(tierErr.message);

  // Import round-robin generator
  const { generateRoundRobin } = await import("@/lib/scheduling/round-robin");

  const allMatches: Array<{
    season_id: string;
    tier_id: string;
    round_number: number;
    match_phase: MatchPhase;
    pool: PoolLabel | null;
    wrestler_a_id?: string | null;
    wrestler_b_id?: string | null;
    tag_team_a_id?: string | null;
    tag_team_b_id?: string | null;
  }> = [];

  for (const tier of (tiers ?? [])) {
    const tierAssigns = (assignments ?? []).filter((a) => a.tier_id === tier.id);
    if (tierAssigns.length < 2) continue;

    // Supabase types single-row joins as arrays; at runtime this is one object
    const isTag =
      (tier.divisions as unknown as { division_type: string } | null)
        ?.division_type === "tag";

    if (tier.has_pools) {
      for (const pool of ["A", "B"] as const) {
        const poolAssigns = tierAssigns.filter((a) => a.pool === pool);
        const ids = poolAssigns.map((a) => (a.wrestler_id || a.tag_team_id)!);
        if (ids.length < 2) continue;
        const schedule = generateRoundRobin(ids);
        for (const match of schedule) {
          allMatches.push({
            season_id: seasonId,
            tier_id: tier.id,
            round_number: match.round,
            match_phase: "pool_play",
            pool,
            ...(isTag
              ? { tag_team_a_id: match.participantA, tag_team_b_id: match.participantB }
              : { wrestler_a_id: match.participantA, wrestler_b_id: match.participantB }),
          });
        }
      }
    } else {
      const ids = tierAssigns.map((a) => (a.wrestler_id || a.tag_team_id)!);
      if (ids.length < 2) continue;
      const schedule = generateRoundRobin(ids);
      for (const match of schedule) {
        allMatches.push({
          season_id: seasonId,
          tier_id: tier.id,
          round_number: match.round,
          match_phase: "pool_play",
          pool: null,
          ...(isTag
            ? { tag_team_a_id: match.participantA, tag_team_b_id: match.participantB }
            : { wrestler_a_id: match.participantA, wrestler_b_id: match.participantB }),
        });
      }
    }
  }

  // Insert matches in batches
  if (allMatches.length > 0) {
    for (let i = 0; i < allMatches.length; i += 500) {
      const { error } = await admin.from("matches").insert(allMatches.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
  }

  // Advance season to pool_play through the validated transition rpc
  const { error: statusErr } = await admin.rpc("advance_season_status", {
    p_season_id: seasonId,
    p_new_status: "pool_play" as SeasonStatus,
  });
  if (statusErr) throw new Error(statusErr.message);

  revalidatePath("/season");
  revalidatePath("/season/setup");
  revalidatePath("/tiers");
  revalidatePath("/");

  return { matchCount: allMatches.length };
}

// ─── Tier Assignment actions ────────────────────────────────────────────────

export async function assignWrestlerToTier(data: {
  season_id: string;
  tier_id: string;
  wrestler_id?: string;
  tag_team_id?: string;
  pool?: PoolLabel | null;
  seed?: number;
}) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("tier_assignments").insert(data);
  if (error) throw new Error(error.message);
  revalidatePath("/season/setup");
  revalidatePath("/tiers");
}

export async function bulkAssignToTier(
  assignments: {
    season_id: string;
    tier_id: string;
    wrestler_id?: string;
    tag_team_id?: string;
    pool?: PoolLabel | null;
    seed?: number;
  }[]
) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("tier_assignments").insert(assignments);
  if (error) throw new Error(error.message);
  revalidatePath("/season/setup");
  revalidatePath("/tiers");
}

export async function clearTagTierAssignments(seasonId: string, tagTierIds: string[]) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("tier_assignments")
    .delete()
    .eq("season_id", seasonId)
    .in("tier_id", tagTierIds);
  if (error) throw new Error(error.message);
  revalidatePath("/season/setup");
  revalidatePath("/tiers");
}

export async function removeFromTier(assignmentId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("tier_assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);
  revalidatePath("/season/setup");
  revalidatePath("/tiers");
}

// ─── Match actions ──────────────────────────────────────────────────────────

export async function bulkCreateMatches(
  matches: {
    season_id: string;
    tier_id: string;
    round_number?: number;
    match_phase: MatchPhase;
    pool?: PoolLabel | null;
    wrestler_a_id?: string | null;
    wrestler_b_id?: string | null;
    tag_team_a_id?: string | null;
    tag_team_b_id?: string | null;
    stipulation?: string | null;
  }[]
) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("matches").insert(matches);
  if (error) throw new Error(error.message);
  revalidatePath("/season");
}

/** Parse an `advances_to` value like "SF2:B" into its target key and slot. */
function parseAdvancesTo(advancesTo: string): { key: string; slot: "A" | "B" } {
  const [key, slot] = advancesTo.split(":");
  return { key, slot: slot === "A" ? "A" : "B" };
}

export async function recordMatchResult(
  matchId: string,
  data: {
    winner_wrestler_id?: string | null;
    winner_tag_team_id?: string | null;
    match_time_seconds: number;
    stipulation?: string;
    notes?: string;
  }
) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: match, error: matchErr } = await admin
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (matchErr) throw new Error(matchErr.message);

  // Validate: winner must be one of the match's participants
  const isTag = !!match.tag_team_a_id;
  const winnerId = isTag ? data.winner_tag_team_id : data.winner_wrestler_id;
  const participantA = isTag ? match.tag_team_a_id : match.wrestler_a_id;
  const participantB = isTag ? match.tag_team_b_id : match.wrestler_b_id;
  if (!winnerId || (winnerId !== participantA && winnerId !== participantB)) {
    throw new Error("Winner must be one of the match participants");
  }
  if (!Number.isFinite(data.match_time_seconds) || data.match_time_seconds <= 0) {
    throw new Error("Match time must be a positive number of seconds");
  }

  // Changing an already-played playoff result whose winner has advanced into a
  // played next-round match would corrupt the bracket — require undo first.
  if (match.played_at && match.advances_to) {
    const { key } = parseAdvancesTo(match.advances_to);
    const { data: target } = await admin
      .from("matches")
      .select("id, played_at")
      .eq("season_id", match.season_id)
      .eq("tier_id", match.tier_id)
      .eq("bracket_key", key)
      .maybeSingle();
    if (target?.played_at) {
      throw new Error(`Undo the ${key} match first before changing this result`);
    }
  }

  const { error } = await admin
    .from("matches")
    .update({
      ...data,
      played_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);

  // Playoff advancement: push the winner into the next round's open slot
  if (match.advances_to) {
    const { key, slot } = parseAdvancesTo(match.advances_to);
    const column = isTag
      ? slot === "A" ? "tag_team_a_id" : "tag_team_b_id"
      : slot === "A" ? "wrestler_a_id" : "wrestler_b_id";
    const { error: advErr } = await admin
      .from("matches")
      .update({ [column]: winnerId })
      .eq("season_id", match.season_id)
      .eq("tier_id", match.tier_id)
      .eq("bracket_key", key);
    if (advErr) throw new Error(advErr.message);
  }

  // Relegation match: record who survives/promotes/relegates as events.
  // Match's tier_id is the higher tier (the defender's); the challenger's
  // assignment gives the lower tier.
  if (match.match_phase === "relegation") {
    const loserId = winnerId === participantA ? participantB! : participantA!;
    const idColumn = isTag ? "tag_team_id" : "wrestler_id";
    const { data: assigns } = await admin
      .from("tier_assignments")
      .select("wrestler_id, tag_team_id, tier_id")
      .eq("season_id", match.season_id)
      .in(idColumn, [winnerId, loserId]);

    const participants = new Map<string, { name: string; currentTierId: string }>();
    for (const a of assigns ?? []) {
      const pid = (a.wrestler_id || a.tag_team_id)!;
      participants.set(pid, { name: "", currentTierId: a.tier_id });
    }
    const higherTierId = match.tier_id;
    const lowerTierId =
      [...participants.values()].find((p) => p.currentTierId !== higherTierId)
        ?.currentTierId ?? higherTierId;

    const { processRelegationMatchResult } = await import(
      "@/lib/relegation/determine-movements"
    );
    const movements = processRelegationMatchResult(
      winnerId,
      loserId,
      higherTierId,
      lowerTierId,
      participants
    );

    // Re-recording a played relegation match replaces its events
    await admin.from("relegation_events").delete().eq("match_id", matchId);
    if (movements.length > 0) {
      const { error: evtErr } = await admin.from("relegation_events").insert(
        movements.map((mv) => ({
          season_id: match.season_id,
          tier_id: mv.fromTierId,
          wrestler_id: isTag ? null : mv.participantId,
          tag_team_id: isTag ? mv.participantId : null,
          movement_type: mv.movementType,
          from_tier_id: mv.fromTierId,
          to_tier_id: mv.toTierId,
          match_id: matchId,
        }))
      );
      if (evtErr) throw new Error(evtErr.message);
    }
    revalidatePath("/season/relegation");
  }

  revalidatePath("/season");
  revalidatePath("/season/playoffs");
  revalidatePath("/tiers");
}

export async function undoMatchResult(matchId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: match, error: matchErr } = await admin
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (matchErr) throw new Error(matchErr.message);

  // If this playoff winner already advanced, clear (or refuse to clear) the slot
  if (match.advances_to && match.played_at) {
    const { key, slot } = parseAdvancesTo(match.advances_to);
    const { data: target } = await admin
      .from("matches")
      .select("id, played_at")
      .eq("season_id", match.season_id)
      .eq("tier_id", match.tier_id)
      .eq("bracket_key", key)
      .maybeSingle();
    if (target?.played_at) {
      throw new Error(`Undo the ${key} match first — its result depends on this one`);
    }
    if (target) {
      const isTag = !!match.tag_team_a_id;
      const column = isTag
        ? slot === "A" ? "tag_team_a_id" : "tag_team_b_id"
        : slot === "A" ? "wrestler_a_id" : "wrestler_b_id";
      const { error: clearErr } = await admin
        .from("matches")
        .update({ [column]: null })
        .eq("id", target.id);
      if (clearErr) throw new Error(clearErr.message);
    }
  }

  // Undoing a relegation match withdraws its movement events
  if (match.match_phase === "relegation") {
    const { error: evtErr } = await admin
      .from("relegation_events")
      .delete()
      .eq("match_id", matchId);
    if (evtErr) throw new Error(evtErr.message);
    revalidatePath("/season/relegation");
  }

  const { error } = await admin
    .from("matches")
    .update({
      winner_wrestler_id: null,
      winner_tag_team_id: null,
      match_time_seconds: null,
      played_at: null,
      notes: null,
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
  revalidatePath("/season");
  revalidatePath("/season/playoffs");
  revalidatePath("/tiers");
}

// ─── Relegation actions ─────────────────────────────────────────────────────

export async function bulkCreateRelegationEvents(
  events: {
    season_id: string;
    tier_id: string;
    wrestler_id?: string | null;
    tag_team_id?: string | null;
    movement_type: "auto_promote" | "auto_relegate" | "playoff_promote" | "playoff_relegate" | "playoff_survive";
    from_tier_id?: string | null;
    to_tier_id?: string | null;
    match_id?: string | null;
  }[]
) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("relegation_events").insert(events);
  if (error) throw new Error(error.message);
  revalidatePath("/season/relegation");
}

// ─── Season Reset actions ───────────────────────────────────────────────────

export async function resetSeasonAssignments(seasonId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  // Delete relegation events first — they can reference matches via match_id
  const { error: relErr } = await admin
    .from("relegation_events")
    .delete()
    .eq("season_id", seasonId);
  if (relErr) throw new Error(relErr.message);

  const { error: matchErr } = await admin
    .from("matches")
    .delete()
    .eq("season_id", seasonId);
  if (matchErr) throw new Error(matchErr.message);

  const { error: assignErr } = await admin
    .from("tier_assignments")
    .delete()
    .eq("season_id", seasonId);
  if (assignErr) throw new Error(assignErr.message);

  // Reset season status to setup
  const { error: statusErr } = await admin
    .from("seasons")
    .update({ status: "setup" as SeasonStatus, started_at: null, completed_at: null })
    .eq("id", seasonId);
  if (statusErr) throw new Error(statusErr.message);

  revalidatePath("/season");
  revalidatePath("/season/setup");
  revalidatePath("/tiers");
}

export async function resetSeasonComplete(seasonId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  // Delete in order: relegation_events (reference matches) → matches →
  // tier_assignments → season
  const { error: relErr } = await admin
    .from("relegation_events")
    .delete()
    .eq("season_id", seasonId);
  if (relErr) throw new Error(relErr.message);

  const { error: matchErr } = await admin
    .from("matches")
    .delete()
    .eq("season_id", seasonId);
  if (matchErr) throw new Error(matchErr.message);

  const { error: assignErr } = await admin
    .from("tier_assignments")
    .delete()
    .eq("season_id", seasonId);
  if (assignErr) throw new Error(assignErr.message);

  const { error: seasonErr } = await admin
    .from("seasons")
    .delete()
    .eq("id", seasonId);
  if (seasonErr) throw new Error(seasonErr.message);

  revalidatePath("/season");
  revalidatePath("/season/setup");
  revalidatePath("/tiers");
  revalidatePath("/dynasty");
}

// ─── Generate Playoff Brackets ──────────────────────────────────────────────

interface PlayoffMatchInsert {
  season_id: string;
  tier_id: string;
  match_phase: MatchPhase;
  pool: null;
  stipulation: string;
  bracket_key: string;
  advances_to: string | null;
  wrestler_a_id?: string | null;
  wrestler_b_id?: string | null;
  tag_team_a_id?: string | null;
  tag_team_b_id?: string | null;
}

/**
 * Build the playoff match inserts for one tier from its pool-play results.
 * Standings come from the shared computeStandings, and pool membership comes
 * from each match's own `pool` column (not participant assignment, which
 * double-counts matches when someone was moved between pools).
 */
async function buildTierPlayoffInserts(
  seasonId: string,
  tier: {
    id: string;
    has_pools: boolean;
    fixed_stipulation: string | null;
    divisions: { division_type: string } | null;
  },
  tierAssigns: Array<{
    wrestler_id: string | null;
    tag_team_id: string | null;
    pool: string | null;
  }>,
  tierMatches: Array<{
    id: string;
    pool: string | null;
    wrestler_a_id: string | null;
    wrestler_b_id: string | null;
    tag_team_a_id: string | null;
    tag_team_b_id: string | null;
    winner_wrestler_id: string | null;
    winner_tag_team_id: string | null;
    match_time_seconds: number | null;
  }>
): Promise<PlayoffMatchInsert[]> {
  const { computeStandings } = await import("@/lib/standings/compute-standings");
  const { computePlayoffSeeds, computeTagPlayoffSeeds } = await import("@/lib/playoffs/seeding");
  const { generateBracket, computeAdvancesMap } = await import("@/lib/playoffs/bracket");
  const { assignStipulation } = await import("@/lib/stipulations/randomizer");

  const isTag = tier.divisions?.division_type === "tag";

  const toResult = (m: (typeof tierMatches)[0]) => ({
    id: m.id,
    wrestlerAId: (m.wrestler_a_id || m.tag_team_a_id)!,
    wrestlerBId: (m.wrestler_b_id || m.tag_team_b_id)!,
    winnerId: (m.winner_wrestler_id || m.winner_tag_team_id)!,
    matchTimeSeconds: m.match_time_seconds ?? 0,
  });

  let seeds;
  if (tier.has_pools) {
    const poolAAssigns = tierAssigns.filter((a) => a.pool === "A");
    const poolBAssigns = tierAssigns.filter((a) => a.pool === "B");
    const poolAStandings = computeStandings(
      poolAAssigns.map((a) => ({ id: (a.wrestler_id || a.tag_team_id)!, name: "" })),
      tierMatches.filter((m) => m.pool === "A").map(toResult)
    );
    const poolBStandings = computeStandings(
      poolBAssigns.map((a) => ({ id: (a.wrestler_id || a.tag_team_id)!, name: "" })),
      tierMatches.filter((m) => m.pool === "B").map(toResult)
    );
    seeds = computePlayoffSeeds(poolAStandings, poolBStandings);
  } else {
    const standings = computeStandings(
      tierAssigns.map((a) => ({ id: (a.wrestler_id || a.tag_team_id)!, name: "" })),
      tierMatches.map(toResult)
    );
    seeds = computeTagPlayoffSeeds(standings);
  }

  const bracketMatches = generateBracket(seeds);
  const advancesMap = computeAdvancesMap(bracketMatches);
  const usedStipulations: string[] = [];

  return bracketMatches.map((bm) => {
    const stip = assignStipulation(tier.fixed_stipulation, usedStipulations);
    usedStipulations.push(stip);
    return {
      season_id: seasonId,
      tier_id: tier.id,
      match_phase: bm.round as MatchPhase,
      pool: null,
      stipulation: stip,
      bracket_key: bm.matchKey,
      advances_to: advancesMap[bm.matchKey] ?? null,
      ...(isTag
        ? {
            tag_team_a_id: bm.seedA?.participantId ?? null,
            tag_team_b_id: bm.seedB?.participantId ?? null,
          }
        : {
            wrestler_a_id: bm.seedA?.participantId ?? null,
            wrestler_b_id: bm.seedB?.participantId ?? null,
          }),
    };
  });
}

export async function generateAllPlayoffBrackets(seasonId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: tiers } = await admin
    .from("tiers")
    .select("*, divisions(name, gender, division_type)")
    .order("tier_number");
  if (!tiers) throw new Error("Failed to load tiers");

  const { data: assignments } = await admin
    .from("tier_assignments")
    .select("tier_id, wrestler_id, tag_team_id, pool")
    .eq("season_id", seasonId);
  if (!assignments) throw new Error("Failed to load assignments");

  const { data: matches } = await admin
    .from("matches")
    .select("*")
    .eq("season_id", seasonId);
  if (!matches) throw new Error("Failed to load matches");

  // Skip tiers that already have playoff matches
  const tiersWithPlayoffs = new Set(
    matches
      .filter((m) => ["quarterfinal", "semifinal", "final"].includes(m.match_phase))
      .map((m) => m.tier_id)
  );

  const allInserts: PlayoffMatchInsert[] = [];
  let generated = 0;

  for (const tier of tiers) {
    if (tiersWithPlayoffs.has(tier.id)) continue;

    const tierAssigns = assignments.filter((a) => a.tier_id === tier.id);
    if (tierAssigns.length < 2) continue;

    const tierMatches = matches.filter(
      (m) => m.tier_id === tier.id && m.match_phase === "pool_play" && m.played_at
    );

    allInserts.push(
      ...(await buildTierPlayoffInserts(seasonId, tier, tierAssigns, tierMatches))
    );
    generated++;
  }

  if (allInserts.length > 0) {
    for (let i = 0; i < allInserts.length; i += 500) {
      const { error } = await admin.from("matches").insert(allInserts.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath("/season");
  revalidatePath("/season/playoffs");
  revalidatePath("/tiers");

  return { tiersGenerated: generated, matchesCreated: allInserts.length };
}

/**
 * Generate the playoff bracket for a single tier. Seeds are computed
 * server-side from fresh data, so the persisted bracket always matches what
 * the standings say — never a stale client snapshot.
 */
export async function generatePlayoffBracketForTier(seasonId: string, tierId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: tier, error: tierErr } = await admin
    .from("tiers")
    .select("*, divisions(name, gender, division_type)")
    .eq("id", tierId)
    .single();
  if (tierErr) throw new Error(tierErr.message);

  const { count: existing } = await admin
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId)
    .eq("tier_id", tierId)
    .in("match_phase", ["quarterfinal", "semifinal", "final"]);
  if ((existing ?? 0) > 0) {
    throw new Error("This tier already has playoff matches");
  }

  const { data: tierAssigns } = await admin
    .from("tier_assignments")
    .select("wrestler_id, tag_team_id, pool")
    .eq("season_id", seasonId)
    .eq("tier_id", tierId);
  if (!tierAssigns || tierAssigns.length < 2) {
    throw new Error("Not enough participants in this tier");
  }

  const { data: tierMatches } = await admin
    .from("matches")
    .select("*")
    .eq("season_id", seasonId)
    .eq("tier_id", tierId)
    .eq("match_phase", "pool_play")
    .not("played_at", "is", null);

  const inserts = await buildTierPlayoffInserts(
    seasonId,
    tier,
    tierAssigns,
    tierMatches ?? []
  );

  const { error } = await admin.from("matches").insert(inserts);
  if (error) throw new Error(error.message);

  revalidatePath("/season");
  revalidatePath("/season/playoffs");
  revalidatePath("/tiers");

  return { matchesCreated: inserts.length };
}

// ─── Relegation Phase ───────────────────────────────────────────────────────

/**
 * Enter the relegation phase: for every adjacent tier pair in each division,
 * determine the automatic promotions/relegations (recorded as events) and
 * create the Steel Cage relegation playoff matches, then advance the season.
 * Final tier standings = pool-play standings with the playoff champion and
 * runner-up lifted to ranks 1-2.
 */
export async function generateRelegationPhase(seasonId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: season, error: seasonErr } = await admin
    .from("seasons")
    .select("status")
    .eq("id", seasonId)
    .single();
  if (seasonErr) throw new Error(seasonErr.message);
  if (season.status !== "playoffs") {
    throw new Error(`Season must be in playoffs to enter relegation (status: ${season.status})`);
  }

  const { data: tiers } = await admin
    .from("tiers")
    .select("id, tier_number, division_id, divisions(division_type)")
    .order("tier_number");
  if (!tiers) throw new Error("Failed to load tiers");

  const { data: assignments } = await admin
    .from("tier_assignments")
    .select("tier_id, wrestler_id, tag_team_id")
    .eq("season_id", seasonId);
  if (!assignments) throw new Error("Failed to load assignments");

  const { data: matches } = await admin
    .from("matches")
    .select("tier_id, match_phase, wrestler_a_id, wrestler_b_id, tag_team_a_id, tag_team_b_id, winner_wrestler_id, winner_tag_team_id, match_time_seconds, played_at")
    .eq("season_id", seasonId);
  if (!matches) throw new Error("Failed to load matches");

  // Every tier that has a playoff bracket must have crowned a champion
  const unfinished = tiers.filter((t) => {
    const finals = matches.filter(
      (m) => m.tier_id === t.id && m.match_phase === "final"
    );
    return finals.length > 0 && finals.some((m) => !m.played_at);
  });
  if (unfinished.length > 0) {
    throw new Error(
      `${unfinished.length} tier(s) still have an unplayed championship final`
    );
  }

  const { computeStandings } = await import("@/lib/standings/compute-standings");
  const { determineMovements } = await import("@/lib/relegation/determine-movements");

  // Final standings per tier: canonical pool-play order, champion & runner-up first
  function finalStandingsFor(tierId: string) {
    const tierAssigns = assignments!.filter((a) => a.tier_id === tierId);
    const poolMatches = matches!.filter(
      (m) => m.tier_id === tierId && m.match_phase === "pool_play" && m.played_at
    );
    const canonical = computeStandings(
      tierAssigns.map((a) => ({ id: (a.wrestler_id || a.tag_team_id)!, name: "" })),
      poolMatches.map((m) => ({
        id: `${m.tier_id}`,
        wrestlerAId: (m.wrestler_a_id || m.tag_team_a_id)!,
        wrestlerBId: (m.wrestler_b_id || m.tag_team_b_id)!,
        winnerId: (m.winner_wrestler_id || m.winner_tag_team_id)!,
        matchTimeSeconds: m.match_time_seconds ?? 0,
      }))
    );

    const final = matches!.find(
      (m) => m.tier_id === tierId && m.match_phase === "final" && m.played_at
    );
    let order = canonical.map((r) => r.participantId);
    if (final) {
      const champion = (final.winner_wrestler_id || final.winner_tag_team_id)!;
      const aId = (final.wrestler_a_id || final.tag_team_a_id)!;
      const bId = (final.wrestler_b_id || final.tag_team_b_id)!;
      const runnerUp = champion === aId ? bId : aId;
      order = [
        champion,
        runnerUp,
        ...order.filter((id) => id !== champion && id !== runnerUp),
      ];
    }
    return order.map((participantId, i) => ({
      participantId,
      name: "",
      finalRank: i + 1,
    }));
  }

  const eventInserts: Array<{
    season_id: string;
    tier_id: string;
    wrestler_id: string | null;
    tag_team_id: string | null;
    movement_type: "auto_promote" | "auto_relegate" | "playoff_promote" | "playoff_relegate" | "playoff_survive";
    from_tier_id: string | null;
    to_tier_id: string | null;
  }> = [];
  const matchInserts: Array<{
    season_id: string;
    tier_id: string;
    match_phase: MatchPhase;
    pool: null;
    stipulation: string;
    wrestler_a_id?: string | null;
    wrestler_b_id?: string | null;
    tag_team_a_id?: string | null;
    tag_team_b_id?: string | null;
  }> = [];

  // Walk adjacent tier pairs within each division
  const byDivision = new Map<string, typeof tiers>();
  for (const t of tiers) {
    if (!byDivision.has(t.division_id)) byDivision.set(t.division_id, []);
    byDivision.get(t.division_id)!.push(t);
  }

  for (const divTiers of byDivision.values()) {
    const sorted = [...divTiers].sort((a, b) => a.tier_number - b.tier_number);
    for (let i = 0; i < sorted.length - 1; i++) {
      const higher = sorted[i];
      const lower = sorted[i + 1];
      // Only pair tiers that both had participants this season
      const higherStandings = finalStandingsFor(higher.id);
      const lowerStandings = finalStandingsFor(lower.id);
      if (higherStandings.length === 0 || lowerStandings.length === 0) continue;

      const isTag =
        (higher.divisions as unknown as { division_type: string } | null)
          ?.division_type === "tag";

      const movements = determineMovements(
        { tierId: higher.id, tierNumber: higher.tier_number, divisionId: higher.division_id },
        { tierId: lower.id, tierNumber: lower.tier_number, divisionId: lower.division_id },
        higherStandings,
        lowerStandings
      );

      for (const mv of movements) {
        if (mv.needsMatch && mv.opponentId) {
          matchInserts.push({
            season_id: seasonId,
            tier_id: higher.id,
            match_phase: "relegation",
            pool: null,
            stipulation: "Steel Cage",
            ...(isTag
              ? { tag_team_a_id: mv.participantId, tag_team_b_id: mv.opponentId }
              : { wrestler_a_id: mv.participantId, wrestler_b_id: mv.opponentId }),
          });
        } else if (!mv.needsMatch) {
          eventInserts.push({
            season_id: seasonId,
            tier_id: mv.fromTierId,
            wrestler_id: isTag ? null : mv.participantId,
            tag_team_id: isTag ? mv.participantId : null,
            movement_type: mv.movementType,
            from_tier_id: mv.fromTierId,
            to_tier_id: mv.toTierId,
          });
        }
      }
    }
  }

  if (eventInserts.length > 0) {
    const { error } = await admin.from("relegation_events").insert(eventInserts);
    if (error) throw new Error(error.message);
  }
  if (matchInserts.length > 0) {
    const { error } = await admin.from("matches").insert(matchInserts);
    if (error) throw new Error(error.message);
  }

  const { error: statusErr } = await admin.rpc("advance_season_status", {
    p_season_id: seasonId,
    p_new_status: "relegation" as SeasonStatus,
  });
  if (statusErr) throw new Error(statusErr.message);

  revalidatePath("/season");
  revalidatePath("/season/relegation");
  revalidatePath("/tiers");
  revalidatePath("/");

  return {
    autoMovements: eventInserts.length,
    relegationMatches: matchInserts.length,
  };
}

// ─── Tier Actions ───────────────────────────────────────────────────────────

export async function updateTierBeltImage(tierId: string, beltImageUrl: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("tiers")
    .update({ belt_image_url: beltImageUrl })
    .eq("id", tierId);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/tiers");
  revalidatePath(`/tiers/${tierId}`);
}

// ─── Wrestler Image Actions ─────────────────────────────────────────────────

export async function fetchAndSaveWrestlerImage(wrestlerId: string, wrestlerName: string) {
  await requireAdmin();
  const { fetchWrestlerImage } = await import("@/lib/images/wikidata");
  const result = await fetchWrestlerImage(wrestlerName);

  if (result.imageUrl) {
    const admin = createAdminClient();
    await admin
      .from("wrestlers")
      .update({ image_url: result.imageUrl })
      .eq("id", wrestlerId);
    revalidatePath("/roster");
    revalidatePath(`/roster/${wrestlerId}`);
    return { success: true, imageUrl: result.imageUrl };
  }
  return { success: false, imageUrl: null };
}

export async function fetchAllWrestlerImages() {
  await requireAdmin();
  const admin = createAdminClient();

  // Get wrestlers without images
  const { data: wrestlers } = await admin
    .from("wrestlers")
    .select("id, name")
    .is("image_url", null)
    .eq("is_active", true);

  if (!wrestlers || wrestlers.length === 0) return { updated: 0, total: 0 };

  const { batchFetchWrestlerImages } = await import("@/lib/images/wikidata");
  const imageMap = await batchFetchWrestlerImages(wrestlers.map((w) => w.name));

  let updated = 0;
  for (const wrestler of wrestlers) {
    const imageUrl = imageMap.get(wrestler.name);
    if (imageUrl) {
      await admin
        .from("wrestlers")
        .update({ image_url: imageUrl })
        .eq("id", wrestler.id);
      updated++;
    }
  }

  revalidatePath("/roster");
  return { updated, total: wrestlers.length };
}

// ─── Mid-Season Expansion ──────────────────────────────────────────────────

/**
 * Add new wrestlers to existing tiers mid-season and generate catch-up matches.
 * Each new wrestler gets matches against every existing wrestler in their pool,
 * plus matches against other new wrestlers in the same pool.
 */
export async function addWrestlersToSeasonMidway(
  seasonId: string,
  newAssignments: Array<{
    tier_id: string;
    wrestler_id: string;
    pool: PoolLabel | null;
    seed?: number;
  }>
) {
  await requireAdmin();
  const admin = createAdminClient();

  // Get existing assignments for the affected tiers
  const affectedTierIds = [...new Set(newAssignments.map((a) => a.tier_id))];
  const { data: existingAssigns } = await admin
    .from("tier_assignments")
    .select("tier_id, wrestler_id, tag_team_id, pool")
    .eq("season_id", seasonId)
    .in("tier_id", affectedTierIds);

  // Get tier info
  const { data: tiers } = await admin
    .from("tiers")
    .select("id, has_pools, divisions(division_type)")
    .in("id", affectedTierIds);

  const tierMap = Object.fromEntries((tiers ?? []).map((t) => [t.id, t]));

  // Insert the new tier assignments
  const assignInserts = newAssignments.map((a) => ({
    season_id: seasonId,
    tier_id: a.tier_id,
    wrestler_id: a.wrestler_id,
    pool: a.pool,
    seed: a.seed,
  }));
  const { error: assignErr } = await admin.from("tier_assignments").insert(assignInserts);
  if (assignErr) throw new Error(assignErr.message);

  // Generate catch-up matches for each new wrestler
  const matchInserts: Array<{
    season_id: string;
    tier_id: string;
    round_number: number;
    match_phase: MatchPhase;
    pool: PoolLabel | null;
    wrestler_a_id: string;
    wrestler_b_id: string;
  }> = [];

  // Get max round numbers per tier/pool for numbering new rounds
  const { data: existingMatches } = await admin
    .from("matches")
    .select("tier_id, pool, round_number")
    .eq("season_id", seasonId)
    .eq("match_phase", "pool_play")
    .in("tier_id", affectedTierIds);

  for (const tierId of affectedTierIds) {
    const tier = tierMap[tierId];
    if (!tier) continue;

    const tierExisting = (existingAssigns ?? []).filter((a) => a.tier_id === tierId);
    const tierNew = newAssignments.filter((a) => a.tier_id === tierId);

    if (tier.has_pools) {
      for (const pool of ["A", "B"] as const) {
        const existingInPool = tierExisting
          .filter((a) => a.pool === pool)
          .map((a) => (a.wrestler_id || a.tag_team_id)!);
        const newInPool = tierNew.filter((a) => a.pool === pool);

        // Get max round for this tier/pool
        const poolMatches = (existingMatches ?? []).filter(
          (m) => m.tier_id === tierId && m.pool === pool
        );
        let maxRound = poolMatches.reduce((max, m) => Math.max(max, m.round_number ?? 0), 0);

        // Each new wrestler vs each existing wrestler (skip self-matches)
        for (const nw of newInPool) {
          for (const existId of existingInPool) {
            if (existId === nw.wrestler_id) continue; // prevent self-match
            maxRound++;
            matchInserts.push({
              season_id: seasonId,
              tier_id: tierId,
              round_number: maxRound,
              match_phase: "pool_play",
              pool,
              wrestler_a_id: nw.wrestler_id,
              wrestler_b_id: existId,
            });
          }
        }

        // New wrestlers vs each other
        for (let i = 0; i < newInPool.length; i++) {
          for (let j = i + 1; j < newInPool.length; j++) {
            maxRound++;
            matchInserts.push({
              season_id: seasonId,
              tier_id: tierId,
              round_number: maxRound,
              match_phase: "pool_play",
              pool,
              wrestler_a_id: newInPool[i].wrestler_id,
              wrestler_b_id: newInPool[j].wrestler_id,
            });
          }
        }
      }
    } else {
      // No pools (tag tiers or single pool)
      const existingIds = tierExisting.map((a) => (a.wrestler_id || a.tag_team_id)!);
      const poolMatches = (existingMatches ?? []).filter((m) => m.tier_id === tierId);
      let maxRound = poolMatches.reduce((max, m) => Math.max(max, m.round_number ?? 0), 0);

      for (const nw of tierNew) {
        for (const existId of existingIds) {
          if (existId === nw.wrestler_id) continue; // prevent self-match
          maxRound++;
          matchInserts.push({
            season_id: seasonId,
            tier_id: tierId,
            round_number: maxRound,
            match_phase: "pool_play",
            pool: null,
            wrestler_a_id: nw.wrestler_id,
            wrestler_b_id: existId,
          });
        }
      }
      for (let i = 0; i < tierNew.length; i++) {
        for (let j = i + 1; j < tierNew.length; j++) {
          maxRound++;
          matchInserts.push({
            season_id: seasonId,
            tier_id: tierId,
            round_number: maxRound,
            match_phase: "pool_play",
            pool: null,
            wrestler_a_id: tierNew[i].wrestler_id,
            wrestler_b_id: tierNew[j].wrestler_id,
          });
        }
      }
    }
  }

  // Insert catch-up matches
  if (matchInserts.length > 0) {
    for (let i = 0; i < matchInserts.length; i += 500) {
      const { error } = await admin.from("matches").insert(matchInserts.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath("/season");
  revalidatePath("/season/setup");
  revalidatePath("/tiers");
  revalidatePath("/");

  return { assigned: assignInserts.length, matchesCreated: matchInserts.length };
}

// ─── Logout ─────────────────────────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
}
