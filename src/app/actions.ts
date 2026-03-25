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

// ─── Logout ─────────────────────────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
}
