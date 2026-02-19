import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generatePitchSuggestions } from "@/lib/ai/ai";
import type { WrapperType } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entityId, wrapperType, priorities } = body as {
      entityId: string;
      wrapperType?: WrapperType;
      priorities?: string[];
    };
    if (!entityId) {
      return NextResponse.json({ error: "entityId required" }, { status: 400 });
    }

    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("id, name, overview")
      .eq("id", entityId)
      .single();
    if (entityError || !entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const result = await generatePitchSuggestions({
      companyName: entity.name,
      overview: entity.overview ?? "",
      wrapperType: wrapperType ?? "ecosystem",
      priorities,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "Pitch suggestions failed", details: String(e) },
      { status: 500 }
    );
  }
}
