import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createAdminClient();

  const [{ data: wrestlers }, { data: allMatches }, { data: tierAssignments }, { data: tiers }] =
    await Promise.all([
      supabase.from("wrestlers").select("id, name, gender").eq("is_active", true).order("name"),
      supabase.from("matches").select("wrestler_a_id, wrestler_b_id, winner_wrestler_id, match_phase, tier_id, match_time_seconds").not("played_at", "is", null),
      supabase.from("tier_assignments").select("wrestler_id, tier_id"),
      supabase.from("tiers").select("id, tier_number"),
    ]);

  const tierMap = Object.fromEntries((tiers ?? []).map((t) => [t.id, t.tier_number]));

  const rows = [
    ["Name", "Gender", "Wins", "Losses", "Win%", "Championships", "Highest Tier", "Playoff Wins", "Finals Appearances", "Avg Match Time (sec)"].join(","),
    ...(wrestlers ?? []).map((w) => {
      const matches = (allMatches ?? []).filter((m) => m.wrestler_a_id === w.id || m.wrestler_b_id === w.id);
      const wins = matches.filter((m) => m.winner_wrestler_id === w.id).length;
      const losses = matches.length - wins;
      const winPct = matches.length > 0 ? ((wins / matches.length) * 100).toFixed(1) : "0";
      const championships = matches.filter((m) => m.match_phase === "final" && m.winner_wrestler_id === w.id).length;
      const playoffWins = matches.filter((m) => ["quarterfinal", "semifinal", "final"].includes(m.match_phase) && m.winner_wrestler_id === w.id).length;
      const finalsAppearances = matches.filter((m) => m.match_phase === "final").length;
      const tierNumbers = (tierAssignments ?? []).filter((a) => a.wrestler_id === w.id).map((a) => tierMap[a.tier_id] ?? 999);
      const highestTier = tierNumbers.length > 0 ? Math.min(...tierNumbers) : "";
      const times = matches.filter((m) => m.match_time_seconds).map((m) => m.match_time_seconds!);
      const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : "";

      return [
        `"${w.name}"`,
        w.gender,
        wins,
        losses,
        winPct,
        championships,
        highestTier,
        playoffWins,
        finalsAppearances,
        avgTime,
      ].join(",");
    }),
  ];

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=dynasty-stats.csv",
    },
  });
}
