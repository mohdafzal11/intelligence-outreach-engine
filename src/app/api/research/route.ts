import { NextResponse } from "next/server";
import { researchCompany } from "@/lib/ingestion/orchestrator";
import { generateInsights } from "@/lib/ai/ai";
import { supabase } from "@/lib/supabase";
import type { Entity, AIInsights, WrapperType } from "@/lib/types";

const DEFAULT_PIPELINE_WRAPPER: WrapperType = "sponsor_devrel";

function dbEnvError(): { error: string; details: string } | null {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    return {
      error: "Missing required config",
      details: `Add to .env.local: ${missing.join(", ")}`,
    };
  }
  return null;
}

/** When true, we skip AI research and save a minimal entity + pipeline row (no Anthropic key needed). */
function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

export async function POST(request: Request) {
  const dbErr = dbEnvError();
  if (dbErr) {
    return NextResponse.json(dbErr, { status: 500 });
  }

  try {
    const body = await request.json();
    const { name, website, twitterHandle } = body as {
      name: string;
      website?: string | null;
      twitterHandle?: string | null;
    };
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }
    const trimmedWebsite = website?.trim() || null;

    // 1. Check if entity with same name or website already exists
    const { data: existingByName, error: existingError } = await supabase
      .from("entities")
      .select("id")
      .ilike("name", trimmedName)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error: "Database error",
          details: existingError.message.includes("does not exist")
            ? "Supabase tables missing. Create entities, people, pipeline, outreach in your project."
            : existingError.message,
        },
        { status: 500 }
      );
    }

    if (existingByName) {
      const existingEntity = await fetchEntityWithRelations(existingByName.id);
      if (existingEntity) {
        return NextResponse.json({
          ...existingEntity,
          existing: true,
        });
      }
    }

    if (trimmedWebsite) {
      const { data: existingByWebsite } = await supabase
        .from("entities")
        .select("id")
        .eq("website", trimmedWebsite)
        .limit(1)
        .maybeSingle();

      if (existingByWebsite && existingByWebsite.id !== existingByName?.id) {
        const existingEntity = await fetchEntityWithRelations(existingByWebsite.id);
        if (existingEntity) {
          return NextResponse.json({
            ...existingEntity,
            existing: true,
          });
        }
      }
    }

    const useAi = hasAnthropicKey();
    let insights: AIInsights | null = null;

    if (useAi) {
      // 2a. Run research + AI (requires ANTHROPIC_API_KEY)
      const research = await researchCompany({
        name: trimmedName,
        website: trimmedWebsite || undefined,
        twitterHandle: twitterHandle?.replace(/^@/, "") || null,
      });

      const rawData = {
        website: research.website,
        google: research.google,
        twitter: research.twitter,
        proxycurl: research.proxycurl,
        github: research.github,
        luma: research.luma,
        lumaScraped: research.lumaScraped,
      };

      try {
        insights = await generateInsights(trimmedName, rawData);
      } catch (e) {
        return NextResponse.json(
          { error: "AI insights failed", details: String(e) },
          { status: 500 }
        );
      }

      // 3a. Save entity with AI-generated overview and fit_score
      const { data: entityRow, error: entityError } = await supabase
        .from("entities")
        .insert({
          name: trimmedName,
          website: trimmedWebsite,
          twitter_handle: twitterHandle?.replace(/^@/, "") || null,
          category: insights.category ?? [],
          description: null,
          overview: insights.overview ?? null,
          fit_score: insights.fit_score ?? null,
          fit_score_breakdown: insights.fit_breakdown ?? null,
          raw_data: { ...rawData, key_hooks: insights.key_hooks ?? [] },
        } as unknown as Omit<Entity, "id" | "created_at" | "updated_at">)
        .select("id, created_at, updated_at")
        .single();

      if (entityError) {
        return NextResponse.json(
          { error: "Failed to save entity", details: entityError.message },
          { status: 500 }
        );
      }

      const entityId = entityRow.id;

      // 4a. Save suggested contacts to people table
      const suggested = insights.suggested_contacts ?? [];
      if (suggested.length > 0) {
        await supabase.from("people").insert(
          suggested.map((c) => ({
            entity_id: entityId,
            name: c.name,
            role: c.likely_role,
            email: null,
            twitter_handle: null,
            linkedin_url: null,
          }))
        );
      }

      // 5a. Auto-create pipeline entry
      await supabase.from("pipeline").insert({
        entity_id: entityId,
        wrapper_type: DEFAULT_PIPELINE_WRAPPER,
        stage: "lead",
        owner: null,
        notes: null,
      });

      const fullEntity = await fetchEntityWithRelations(entityId);
      if (!fullEntity) {
        return NextResponse.json(
          { error: "Failed to load created entity" },
          { status: 500 }
        );
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
    }

    // 2b. No Anthropic key: save minimal entity + pipeline (no research, no AI)
    const { data: entityRow, error: entityError } = await supabase
      .from("entities")
      .insert({
        name: trimmedName,
        website: trimmedWebsite,
        twitter_handle: twitterHandle?.replace(/^@/, "") || null,
        category: [],
        description: null,
        overview: "Added without AI research. Add ANTHROPIC_API_KEY to .env.local for auto-generated insights.",
        fit_score: 50,
        fit_score_breakdown: null,
        raw_data: null,
      } as unknown as Omit<Entity, "id" | "created_at" | "updated_at">)
      .select("id, created_at, updated_at")
      .single();

    if (entityError) {
      return NextResponse.json(
        { error: "Failed to save entity", details: entityError.message },
        { status: 500 }
      );
    }

    const entityId = entityRow.id;

    await supabase.from("pipeline").insert({
      entity_id: entityId,
      wrapper_type: DEFAULT_PIPELINE_WRAPPER,
      stage: "lead",
      owner: null,
      notes: null,
    });

    const fullEntity = await fetchEntityWithRelations(entityId);
    if (!fullEntity) {
      return NextResponse.json(
        { error: "Failed to load created entity" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...fullEntity,
      addedWithoutResearch: true,
      message: "Company saved to DB. Add ANTHROPIC_API_KEY for AI-generated insights next time.",
    });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    console.error("[research] POST error:", details, e);
    return NextResponse.json(
      { error: "Research failed", details },
      { status: 500 }
    );
  }
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
    supabase
      .from("outreach")
      .select("*")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false }),
    supabase
      .from("pipeline")
      .select("*")
      .eq("entity_id", entityId)
      .order("updated_at", { ascending: false }),
  ]);

  if (entityError || !entity) return null;
  return {
    ...entity,
    people: people ?? [],
    outreach: outreach ?? [],
    pipeline: pipeline ?? [],
  };
}
