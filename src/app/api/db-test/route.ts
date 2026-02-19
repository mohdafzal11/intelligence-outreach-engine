import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/db-test — Quick check: insert one entity, read it back, delete it.
 * Use to verify Supabase client and tables work.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const testName = "DB Test " + Date.now();

  const { data: inserted, error: insertError } = await supabase
    .from("entities")
    .insert({
      name: testName,
      website: "https://test.example.com",
      twitter_handle: null,
      category: ["Test"],
      description: null,
      overview: "Test",
      fit_score: 50,
      fit_score_breakdown: null,
      raw_data: null,
    })
    .select("id, name, created_at")
    .single();

  if (insertError) {
    return NextResponse.json(
      { ok: false, error: "Insert failed", details: insertError.message },
      { status: 500 }
    );
  }

  const { data: read, error: readError } = await supabase
    .from("entities")
    .select("*")
    .eq("id", inserted.id)
    .single();

  if (readError) {
    await supabase.from("entities").delete().eq("id", inserted.id);
    return NextResponse.json(
      { ok: false, error: "Read failed", details: readError.message },
      { status: 500 }
    );
  }

  const { error: deleteError } = await supabase.from("entities").delete().eq("id", inserted.id);
  if (deleteError) {
    return NextResponse.json(
      { ok: false, error: "Delete failed", details: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Supabase client works: insert, read, delete succeeded.",
    read: { id: read.id, name: read.name },
  });
}
