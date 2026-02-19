import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { OutreachStatus } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status } = body as { status?: OutreachStatus };
  if (status === undefined) {
    return NextResponse.json({ error: "status required" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("outreach")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
