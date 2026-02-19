import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { PipelineStage, WrapperType } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wrapperType = searchParams.get("wrapper_type");
  const stage = searchParams.get("stage");

  let query = supabase
    .from("pipeline")
    .select("*, entities(id, name, fit_score, website, twitter_handle, overview, category)")
    .order("updated_at", { ascending: false });
  if (wrapperType) query = query.eq("wrapper_type", wrapperType);
  if (stage) query = query.eq("stage", stage);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entityId, wrapperType, stage, owner, notes } = body as {
      entityId: string;
      wrapperType: WrapperType;
      stage?: PipelineStage;
      owner?: string | null;
      notes?: string | null;
    };
    if (!entityId || !wrapperType) {
      return NextResponse.json(
        { error: "entityId and wrapperType required" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("pipeline")
      .select("id, stage, created_at")
      .eq("entity_id", entityId)
      .eq("wrapper_type", wrapperType)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { existing: true, message: "Already in pipeline", pipeline: existing },
        { status: 200 }
      );
    }

    const { data, error } = await supabase
      .from("pipeline")
      .insert({
        entity_id: entityId,
        wrapper_type: wrapperType,
        stage: stage ?? "lead",
        owner: owner ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: "Create pipeline failed", details: String(e) },
      { status: 500 }
    );
  }
}
