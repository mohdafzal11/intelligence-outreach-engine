import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchTwitterProfilesFromSocialApi, hasSocialApiKey } from "@/lib/ingestion/social-api";
import type { Entity, WrapperType } from "@/lib/types";

const DEFAULT_PIPELINE_WRAPPER: WrapperType = "sponsor_devrel";

function dbEnvError(): { error: string; details: string } | null {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    return { error: "Missing required config", details: `Add to .env.local: ${missing.join(", ")}` };
  }
  return null;
}

/**
 * POST /api/twitter/fetch-and-save
 * Body: { handles: string[] } — Twitter handles (with or without @). Can be one or many.
 * Requires SOCIALAPI_API_KEY. Fetches each handle from Social API (Twitter data) and saves as entity + pipeline row.
 */
export async function POST(request: Request) {
  const dbErr = dbEnvError();
  if (dbErr) return NextResponse.json(dbErr, { status: 500 });

  if (!hasSocialApiKey()) {
    return NextResponse.json(
      { error: "Social API not configured", details: "Add SOCIALAPI_API_KEY to .env.local" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const raw = (body?.handles ?? body?.twitterHandles ?? body?.twitterHandle) as unknown;
    const handles: string[] = Array.isArray(raw)
      ? raw.map((h: unknown) => String(h ?? "").trim()).filter(Boolean)
      : typeof raw === "string"
        ? raw
          .split(/[\s,]+/)
          .map((h: string) => h.trim())
          .filter(Boolean)
        : [];

    if (handles.length === 0) {
      return NextResponse.json(
        { error: "No handles provided", details: "Send { handles: ['@user1', 'user2'] } or { twitterHandle: '@user' }" },
        { status: 400 }
      );
    }

    const results = await fetchTwitterProfilesFromSocialApi(handles);
    const created: { handle: string; entityId: string; name: string }[] = [];
    const skipped: { handle: string; reason: string }[] = [];
    const failed: { handle: string; reason: string }[] = [];

    for (const handle of results.keys()) {
      const twitter = results.get(handle) ?? null;
      const cleanHandle = handle.replace(/^@/, "");

      const { data: existing } = await supabase
        .from("entities")
        .select("id")
        .ilike("twitter_handle", cleanHandle)
        .limit(1)
        .maybeSingle();

      if (existing) {
        skipped.push({ handle: `@${cleanHandle}`, reason: "Entity with this Twitter handle already exists" });
        continue;
      }

      if (!twitter) {
        failed.push({ handle: `@${cleanHandle}`, reason: "Social API returned no data" });
        continue;
      }

      const name =
        (twitter.profile.name?.trim() && twitter.profile.name !== twitter.profile.username)
          ? twitter.profile.name
          : cleanHandle;

      const { data: entityRow, error: entityError } = await supabase
        .from("entities")
        .insert({
          name,
          website: null,
          twitter_handle: cleanHandle,
          category: [],
          description: twitter.profile.description ?? null,
          overview: null,
          fit_score: 50,
          fit_score_breakdown: null,
          raw_data: { twitter },
        } as unknown as Omit<Entity, "id" | "created_at" | "updated_at">)
        .select("id, name")
        .single();

      if (entityError) {
        failed.push({ handle: `@${cleanHandle}`, reason: entityError.message });
        continue;
      }

      await supabase.from("pipeline").insert({
        entity_id: entityRow.id,
        wrapper_type: DEFAULT_PIPELINE_WRAPPER,
        stage: "lead",
        owner: null,
        notes: null,
      });

      created.push({ handle: `@${cleanHandle}`, entityId: entityRow.id, name: entityRow.name });
    }

    return NextResponse.json({
      created,
      skipped,
      failed,
      message:
        created.length > 0
          ? `Saved ${created.length} account(s) to DB.`
          : failed.length > 0
            ? "No new entities saved; see failed/skipped."
            : "No handles to process.",
    });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    console.error("[twitter/fetch-and-save] error:", details, e);
    return NextResponse.json({ error: "Request failed", details }, { status: 500 });
  }
}
