import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateProposal } from "@/lib/ai/ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entityId } = body as { entityId: string };
    if (!entityId) {
      return NextResponse.json({ error: "entityId required" }, { status: 400 });
    }

    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("id, name, overview, fit_score")
      .eq("id", entityId)
      .single();
    if (entityError || !entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const result = await generateProposal({
      companyName: entity.name,
      overview: entity.overview ?? "",
      fitScore: entity.fit_score,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "Proposal generation failed", details: String(e) },
      { status: 500 }
    );
  }
}
