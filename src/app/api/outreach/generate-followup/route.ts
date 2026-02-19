import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateFollowUp } from "@/lib/ai/ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { outreachId, followUpNumber } = body as {
      outreachId: string;
      followUpNumber: number;
    };
    if (!outreachId || followUpNumber == null || followUpNumber < 1) {
      return NextResponse.json(
        { error: "outreachId and followUpNumber (>= 1) required" },
        { status: 400 }
      );
    }

    const { data: outreach, error: outreachError } = await supabase
      .from("outreach")
      .select("id, entity_id, body, subject")
      .eq("id", outreachId)
      .single();
    if (outreachError || !outreach) {
      return NextResponse.json({ error: "Outreach not found" }, { status: 404 });
    }

    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("name")
      .eq("id", outreach.entity_id)
      .single();
    if (entityError || !entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const draft = await generateFollowUp({
      companyName: entity.name,
      originalBody: outreach.body,
      followUpNumber,
    });
    return NextResponse.json(draft);
  } catch (e) {
    return NextResponse.json(
      { error: "Follow-up generation failed", details: String(e) },
      { status: 500 }
    );
  }
}
