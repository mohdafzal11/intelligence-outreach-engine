import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wrapperType = searchParams.get("wrapper_type");
  const status = searchParams.get("status");

  let query = supabase
    .from("outreach")
    .select("*, entities(id, name), people(id, name, role)")
    .order("created_at", { ascending: false });
  if (wrapperType) query = query.eq("wrapper_type", wrapperType);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
