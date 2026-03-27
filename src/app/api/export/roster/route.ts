import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createAdminClient();
  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("name, gender, brand, overall_rating, is_active")
    .order("name");

  const rows = [
    ["Name", "Gender", "Brand", "Overall", "Active"].join(","),
    ...(wrestlers ?? []).map((w) =>
      [
        `"${w.name}"`,
        w.gender,
        `"${w.brand ?? ""}"`,
        w.overall_rating ?? "",
        w.is_active ? "Yes" : "No",
      ].join(",")
    ),
  ];

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=roster.csv",
    },
  });
}
