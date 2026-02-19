import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const topic = searchParams.get("topic")?.trim();

  let query = supabase.from("entities").select("*").order("created_at", { ascending: false });
  if (search) {
    const term = search.replace(/\s+/g, " ").trim();
    const termNoSpaces = term.replace(/\s+/g, "");
    const parts = [
      `name.ilike.%${term}%`,
      `overview.ilike.%${term}%`,
      ...(termNoSpaces ? [`name.ilike.%${termNoSpaces}%`, `overview.ilike.%${termNoSpaces}%`] : []),
    ];
    query = query.or(parts.join(","));
  }
  if (topic) {
    query = query.contains("category", [topic]);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
