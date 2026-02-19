import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { researchCompany } from "@/lib/ingestion/orchestrator";
import { generateInsights } from "@/lib/ai/ai";
import type { Entity, AIInsights } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [
    { data: entity, error: entityError },
    { data: people },
    { data: outreach },
    { data: pipeline },
  ] = await Promise.all([
    supabase.from("entities").select("*").eq("id", id).single(),
    supabase.from("people").select("*").eq("entity_id", id),
    supabase.from("outreach").select("*").eq("entity_id", id).order("created_at", { ascending: false }),
    supabase.from("pipeline").select("*").eq("entity_id", id).order("updated_at", { ascending: false }),
  ]);

  if (entityError || !entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...entity,
    people: people ?? [],
    outreach: outreach ?? [],
    pipeline: pipeline ?? [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { fit_score } = body as { fit_score?: number | null };
  if (fit_score === undefined) {
    return NextResponse.json({ error: "fit_score required" }, { status: 400 });
  }
  const score = fit_score == null ? null : Math.min(100, Math.max(0, Number(fit_score)));
  const { data, error } = await supabase
    .from("entities")
    .update({ fit_score: score, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

async function fetchEntityWithRelations(entityId: string) {
  const [
    { data: entity, error: entityError },
    { data: people },
    { data: outreach },
    { data: pipeline },
  ] = await Promise.all([
    supabase.from("entities").select("*").eq("id", entityId).single(),
    supabase.from("people").select("*").eq("entity_id", entityId),
    supabase.from("outreach").select("*").eq("entity_id", entityId).order("created_at", { ascending: false }),
    supabase.from("pipeline").select("*").eq("entity_id", entityId).order("updated_at", { ascending: false }),
  ]);
  if (entityError || !entity) return null;
  return { ...entity, people: people ?? [], outreach: outreach ?? [], pipeline: pipeline ?? [] };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("id, name, website, twitter_handle")
      .eq("id", id)
      .single();
    if (entityError || !entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const research = await researchCompany({
      name: entity.name,
      website: entity.website ?? undefined,
      twitterHandle: entity.twitter_handle ?? null,
    });
    const rawData = {
      website: research.website,
      google: research.google,
      twitter: research.twitter,
    };

    let insights: AIInsights;
    try {
      insights = await generateInsights(entity.name, rawData);
    } catch (e) {
      return NextResponse.json(
        { error: "AI insights failed", details: String(e) },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("entities")
      .update({
        category: insights.category ?? [],
        overview: insights.overview ?? null,
        fit_score: insights.fit_score ?? null,
        fit_score_breakdown: (insights.fit_breakdown ?? null) as Record<string, number> | null,
        raw_data: { ...rawData, key_hooks: insights.key_hooks ?? [] },
      } as Partial<Entity>)
      .eq("id", id);
    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update entity", details: updateError.message },
        { status: 500 }
      );
    }

    await supabase.from("people").delete().eq("entity_id", id);
    const suggested = insights.suggested_contacts ?? [];
    if (suggested.length > 0) {
      await supabase.from("people").insert(
        suggested.map((c) => ({
          entity_id: id,
          name: c.name,
          role: c.likely_role,
          email: null,
          twitter_handle: null,
          linkedin_url: null,
        }))
      );
    }

    const fullEntity = await fetchEntityWithRelations(id);
    if (!fullEntity) {
      return NextResponse.json({ error: "Failed to load entity" }, { status: 500 });
    }
    return NextResponse.json({
      ...fullEntity,
      insights: {
        overview: insights.overview,
        category: insights.category,
        fit_score: insights.fit_score,
        fit_breakdown: insights.fit_breakdown,
        suggested_contacts: insights.suggested_contacts,
        key_hooks: insights.key_hooks,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Refresh failed", details: String(e) },
      { status: 500 }
    );
  }
}
