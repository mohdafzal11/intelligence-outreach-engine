import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { PipelineStage, WrapperType } from "@/lib/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { stage, wrapper_type, owner, notes } = body as {
    stage?: PipelineStage;
    wrapper_type?: WrapperType;
    owner?: string | null;
    notes?: string | null;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (stage !== undefined) updates.stage = stage;
  if (wrapper_type !== undefined) updates.wrapper_type = wrapper_type;
  if (owner !== undefined) updates.owner = owner;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase
    .from("pipeline")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
