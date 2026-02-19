import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateOutreach } from "@/lib/ai/ai";
import type { OutreachChannel, WrapperType } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entityId, personName, channel, wrapperType, personId } = body as {
      entityId: string;
      personName?: string | null;
      channel: OutreachChannel;
      wrapperType: WrapperType;
      personId?: string | null;
    };
    if (!entityId || !channel || !wrapperType) {
      return NextResponse.json(
        { error: "entityId, channel, wrapperType required" },
        { status: 400 }
      );
    }

    // Fetch full entity from DB (overview and key_hooks for generation)
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("id, name, overview, raw_data")
      .eq("id", entityId)
      .single();
    if (entityError || !entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    let person: { name: string; role?: string | null } = { name: entity.name };
    if (personName?.trim()) {
      person = { name: personName.trim(), role: null };
    } else if (personId) {
      const { data: p } = await supabase
        .from("people")
        .select("name, role")
        .eq("id", personId)
        .single();
      if (p) person = { name: p.name, role: p.role };
    }

    const rawData = entity.raw_data as { key_hooks?: string[] } | null;
    const hooks: string[] = Array.isArray(rawData?.key_hooks)
      ? rawData.key_hooks
      : entity.overview
        ? ["Relevant partnership opportunity with HEM"]
        : [];

    let templateSnippets: string[] = [];
    const { data: templates, error: _te } = await supabase
      .from("outreach_templates")
      .select("content")
      .eq("wrapper_type", wrapperType)
      .limit(5);
    if (!_te && templates?.length) {
      templateSnippets = templates.map((t) => t.content);
    }

    const draft = await generateOutreach({
      companyName: entity.name,
      overview: entity.overview ?? "",
      person,
      channel,
      wrapperType,
      hooks,
      templateSnippets: templateSnippets.length ? templateSnippets : undefined,
    });
    return NextResponse.json(draft);
  } catch (e) {
    return NextResponse.json(
      { error: "Draft failed", details: String(e) },
      { status: 500 }
    );
  }
}
