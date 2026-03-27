import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const seasonId = request.nextUrl.searchParams.get("season");

  let query = supabase
    .from("matches")
    .select(
      "*, tiers(name, short_name, tier_number), seasons(season_number)"
    )
    .not("played_at", "is", null)
    .order("played_at", { ascending: true });

  if (seasonId) {
    query = query.eq("season_id", seasonId);
  }

  const [{ data: matches }, { data: wrestlers }, { data: tagTeams }] =
    await Promise.all([
      query,
      supabase.from("wrestlers").select("id, name"),
      supabase.from("tag_teams").select("id, name"),
    ]);

  const nameMap = Object.fromEntries([
    ...(wrestlers ?? []).map((w) => [w.id, w.name] as const),
    ...(tagTeams ?? []).map((t) => [t.id, t.name] as const),
  ]);

  const rows = [
    [
      "Season",
      "Tier",
      "Phase",
      "Pool",
      "Round",
      "Participant A",
      "Participant B",
      "Winner",
      "Time (sec)",
      "Stipulation",
      "Notes",
      "Date",
    ].join(","),
    ...(matches ?? []).map((m) => {
      const tier = m.tiers as { name: string; short_name: string | null; tier_number: number } | null;
      const season = m.seasons as { season_number: number } | null;
      const aId = m.wrestler_a_id || m.tag_team_a_id;
      const bId = m.wrestler_b_id || m.tag_team_b_id;
      const winnerId = m.winner_wrestler_id || m.winner_tag_team_id;
      return [
        season?.season_number ?? "",
        `"${tier?.short_name || tier?.name || ""}"`,
        m.match_phase,
        m.pool ?? "",
        m.round_number ?? "",
        `"${nameMap[aId ?? ""] ?? ""}"`,
        `"${nameMap[bId ?? ""] ?? ""}"`,
        `"${nameMap[winnerId ?? ""] ?? ""}"`,
        m.match_time_seconds ?? "",
        `"${m.stipulation ?? ""}"`,
        `"${(m.notes ?? "").replace(/"/g, '""')}"`,
        m.played_at ? new Date(m.played_at).toISOString().split("T")[0] : "",
      ].join(",");
    }),
  ];

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=matches${seasonId ? `-${seasonId}` : ""}.csv`,
    },
  });
}
