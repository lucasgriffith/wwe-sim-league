"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  Gender,
  SeasonStatus,
  PoolLabel,
  MatchPhase,
} from "@/types/database";

// ─── Auth helper ────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
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
  const { error } = await admin.from("tag_teams").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tag-teams");
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
  const { error } = await admin
    .from("matches")
    .update({
      ...data,
      played_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
  revalidatePath("/season");
  revalidatePath("/tiers");
}

export async function undoMatchResult(matchId: string) {
  await requireAdmin();
  const admin = createAdminClient();
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

  // Delete matches for this season
  const { error: matchErr } = await admin
    .from("matches")
    .delete()
    .eq("season_id", seasonId);
  if (matchErr) throw new Error(matchErr.message);

  // Delete tier assignments for this season
  const { error: assignErr } = await admin
    .from("tier_assignments")
    .delete()
    .eq("season_id", seasonId);
  if (assignErr) throw new Error(assignErr.message);

  // Delete relegation events for this season
  const { error: relErr } = await admin
    .from("relegation_events")
    .delete()
    .eq("season_id", seasonId);
  if (relErr) throw new Error(relErr.message);

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

  // Delete in order: matches → relegation_events → tier_assignments → season
  const { error: matchErr } = await admin
    .from("matches")
    .delete()
    .eq("season_id", seasonId);
  if (matchErr) throw new Error(matchErr.message);

  const { error: relErr } = await admin
    .from("relegation_events")
    .delete()
    .eq("season_id", seasonId);
  if (relErr) throw new Error(relErr.message);

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

// ─── Generate All Playoff Brackets ──────────────────────────────────────────

export async function generateAllPlayoffBrackets(seasonId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  // Get all tiers with divisions
  const { data: tiers } = await admin
    .from("tiers")
    .select("*, divisions(name, gender, division_type)")
    .order("tier_number");

  if (!tiers) throw new Error("Failed to load tiers");

  // Get all assignments for this season
  const { data: assignments } = await admin
    .from("tier_assignments")
    .select("tier_id, wrestler_id, tag_team_id, pool")
    .eq("season_id", seasonId);

  if (!assignments) throw new Error("Failed to load assignments");

  // Get all matches for this season
  const { data: matches } = await admin
    .from("matches")
    .select("*")
    .eq("season_id", seasonId);

  if (!matches) throw new Error("Failed to load matches");

  // Check which tiers already have playoff matches
  const tiersWithPlayoffs = new Set(
    matches
      .filter((m) => ["quarterfinal", "semifinal", "final"].includes(m.match_phase))
      .map((m) => m.tier_id)
  );

  // Import playoff utilities dynamically
  const { computeStandings } = await import("@/lib/standings/compute-standings");
  const { computePlayoffSeeds, computeTagPlayoffSeeds } = await import("@/lib/playoffs/seeding");
  const { generateBracket } = await import("@/lib/playoffs/bracket");
  const { assignStipulation } = await import("@/lib/stipulations/randomizer");

  const allInserts: Array<{
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

  let generated = 0;

  for (const tier of tiers) {
    if (tiersWithPlayoffs.has(tier.id)) continue;

    const tierAssigns = assignments.filter((a) => a.tier_id === tier.id);
    if (tierAssigns.length < 2) continue;

    const isTag = tier.divisions?.division_type === "tag";
    const tierMatches = matches.filter(
      (m) => m.tier_id === tier.id && m.match_phase === "pool_play" && m.played_at
    );

    // Build match results
    const matchResults = tierMatches.map((m) => ({
      id: m.id,
      wrestlerAId: (m.wrestler_a_id || m.tag_team_a_id)!,
      wrestlerBId: (m.wrestler_b_id || m.tag_team_b_id)!,
      winnerId: (m.winner_wrestler_id || m.winner_tag_team_id)!,
      matchTimeSeconds: m.match_time_seconds ?? 0,
    }));

    let seeds;
    if (tier.has_pools) {
      const poolAAssigns = tierAssigns.filter((a) => a.pool === "A");
      const poolBAssigns = tierAssigns.filter((a) => a.pool === "B");
      const poolAMatches = matchResults.filter((m) =>
        poolAAssigns.some((a) => (a.wrestler_id || a.tag_team_id) === m.wrestlerAId || (a.wrestler_id || a.tag_team_id) === m.wrestlerBId)
      );
      const poolBMatches = matchResults.filter((m) =>
        poolBAssigns.some((a) => (a.wrestler_id || a.tag_team_id) === m.wrestlerAId || (a.wrestler_id || a.tag_team_id) === m.wrestlerBId)
      );

      const getName = (id: string) => id; // Seeds don't need names for match creation
      const poolAStandings = computeStandings(
        poolAAssigns.map((a) => ({ id: (a.wrestler_id || a.tag_team_id)!, name: "" })),
        poolAMatches
      );
      const poolBStandings = computeStandings(
        poolBAssigns.map((a) => ({ id: (a.wrestler_id || a.tag_team_id)!, name: "" })),
        poolBMatches
      );
      seeds = computePlayoffSeeds(poolAStandings, poolBStandings);
    } else {
      const standings = computeStandings(
        tierAssigns.map((a) => ({ id: (a.wrestler_id || a.tag_team_id)!, name: "" })),
        matchResults
      );
      seeds = computeTagPlayoffSeeds(standings);
    }

    const bracketMatches = generateBracket(seeds);
    const usedStipulations: string[] = [];

    for (const bm of bracketMatches) {
      const stip = assignStipulation(tier.fixed_stipulation, usedStipulations);
      usedStipulations.push(stip);

      allInserts.push({
        season_id: seasonId,
        tier_id: tier.id,
        match_phase: bm.round as MatchPhase,
        pool: null,
        stipulation: stip,
        ...(isTag
          ? {
              tag_team_a_id: bm.seedA?.participantId ?? null,
              tag_team_b_id: bm.seedB?.participantId ?? null,
            }
          : {
              wrestler_a_id: bm.seedA?.participantId ?? null,
              wrestler_b_id: bm.seedB?.participantId ?? null,
            }),
      });
    }
    generated++;
  }

  if (allInserts.length > 0) {
    // Insert in batches
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

// ─── Logout ─────────────────────────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
}
