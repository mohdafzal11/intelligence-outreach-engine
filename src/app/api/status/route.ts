import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/status — Shows what's configured and what's missing.
 * Open http://localhost:3030/api/status to see env, DB, and what you need to set.
 */
export async function GET() {
  const required = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY?.trim(),
  };
  const optional = {
    FIRECRAWL_API_KEY: !!process.env.FIRECRAWL_API_KEY?.trim(),
    SERPAPI_API_KEY: !!process.env.SERPAPI_API_KEY?.trim(),
    TWITTER_BEARER_TOKEN: !!process.env.TWITTER_BEARER_TOKEN?.trim(),
    PROXYCURL_API_KEY: !!process.env.PROXYCURL_API_KEY?.trim(),
    GITHUB_TOKEN: !!process.env.GITHUB_TOKEN?.trim(),
    LUMA_API_KEY: !!process.env.LUMA_API_KEY?.trim(),
  };

  let dbOk = false;
  let dbMessage = "";

  if (required.NEXT_PUBLIC_SUPABASE_URL && required.SUPABASE_SERVICE_ROLE_KEY) {
    const { data, error } = await supabase.from("entities").select("id").limit(1);
    if (error) {
      dbMessage = error.message;
    } else {
      dbOk = true;
      dbMessage = "Connected. Tables exist.";
    }
  } else {
    dbMessage = "Set Supabase env vars first.";
  }

  const allRequiredSet = Object.values(required).every(Boolean);

  return NextResponse.json({
    app: "NEXUS Intelligence & Outreach Engine",
    requiredEnv: required,
    optionalEnv: optional,
    allRequiredSet,
    db: { ok: dbOk, message: dbMessage },
    nextSteps: [
      ...(!allRequiredSet
        ? ["Add missing keys to .env.local (see SETUP_CHECKLIST.md or API_KEYS.md)"]
        : []),
      ...(allRequiredSet && !dbOk
        ? ["Run SUPABASE_SETUP.sql in Supabase SQL Editor (Dashboard → SQL Editor)"]
        : []),
      ...(allRequiredSet && dbOk
        ? ["Run app: npm run dev:safe → open http://localhost:3030"]
        : []),
    ],
    apis: [
      { path: "/api/status", method: "GET", purpose: "This page – env & DB status" },
      { path: "/api/db-test", method: "GET", purpose: "Insert/read/delete test on entities" },
      { path: "/api/entities", method: "GET", purpose: "List entities (optional ?search=)" },
      { path: "/api/entities/[id]", method: "GET", purpose: "Single entity with people, outreach" },
      { path: "/api/pipeline", method: "GET", purpose: "Pipeline rows (for Pipeline view)" },
      { path: "/api/research", method: "POST", purpose: "Add company – needs ANTHROPIC_API_KEY" },
      { path: "/api/outreach", method: "GET", purpose: "Outreach history" },
      { path: "/api/luma/events", method: "GET", purpose: "Luma events (optional ?company=)" },
    ],
  });
}
