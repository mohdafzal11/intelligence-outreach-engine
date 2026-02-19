import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/luma/events/saved?company=Polygon+Labs
 * Returns events saved in DB for the given company (match by company_name ilike).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company")?.trim();

  if (!company) {
    return NextResponse.json(
      { error: "Query param 'company' required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("luma_events")
    .select("*")
    .ilike("company_name", `%${company}%`)
    .order("start_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
