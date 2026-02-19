import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { callOpenRouter } from "@/lib/openrouter";

// Check if chat tables exist, try to create them if not
let tablesChecked = false;
async function ensureChatTables(): Promise<boolean> {
  if (tablesChecked) return true;
  const { error } = await supabase
    .from("chat_sessions")
    .select("id")
    .limit(1);
  if (!error) {
    tablesChecked = true;
    return true;
  }
  // Tables don't exist — try creating via raw SQL (requires service role)
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          "Content-Type": "application/json",
        },
      }
    );
    // If rpc doesn't work, tables must be created manually
    void res;
  } catch {
    // ignore
  }
  return false;
}

const SYSTEM_PROMPT = `You are a CRM intelligence assistant for HEM (India Blockchain Week).
You have access to the current pipeline and outreach data provided below.
Help the user understand their pipeline, outreach progress, team performance, and suggest next steps.
Be concise, data-driven, and actionable. Use numbers and specifics from the data.
If the user asks to generate a summary or report, provide a structured overview with sections.`;

// Fetch live pipeline + outreach data to give the LLM context
async function fetchCRMContext(): Promise<string> {
  const [pipelineRes, outreachRes, entitiesRes] = await Promise.allSettled([
    supabase
      .from("pipeline")
      .select("id, entity_id, wrapper_type, stage, notes, updated_at, entities(name, category, fit_score)")
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("outreach")
      .select("id, channel, status, wrapper_type, created_at, entities(name)")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("entities")
      .select("id, name, fit_score, category, overview")
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);

  const pipeline =
    pipelineRes.status === "fulfilled" ? pipelineRes.value.data ?? [] : [];
  const outreach =
    outreachRes.status === "fulfilled" ? outreachRes.value.data ?? [] : [];
  const entities =
    entitiesRes.status === "fulfilled" ? entitiesRes.value.data ?? [] : [];

  // Build stats
  const stageCounts: Record<string, number> = {};
  for (const p of pipeline) {
    stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1;
  }

  const outreachStatusCounts: Record<string, number> = {};
  const channelCounts: Record<string, number> = {};
  for (const o of outreach) {
    outreachStatusCounts[o.status] = (outreachStatusCounts[o.status] ?? 0) + 1;
    channelCounts[o.channel] = (channelCounts[o.channel] ?? 0) + 1;
  }

  return `--- CURRENT CRM DATA ---
Total entities: ${entities.length}
Pipeline entries: ${pipeline.length}
Pipeline by stage: ${JSON.stringify(stageCounts)}
Total outreach: ${outreach.length}
Outreach by status: ${JSON.stringify(outreachStatusCounts)}
Outreach by channel: ${JSON.stringify(channelCounts)}

Recent pipeline leads:
${pipeline
  .slice(0, 15)
  .map(
    (p) =>
      `- ${(p.entities as unknown as Record<string, unknown>)?.name ?? "?"} | stage: ${p.stage} | type: ${p.wrapper_type} | score: ${(p.entities as unknown as Record<string, unknown>)?.fit_score ?? "?"}`
  )
  .join("\n")}

Recent outreach:
${outreach
  .slice(0, 10)
  .map(
    (o) =>
      `- ${(o.entities as unknown as Record<string, unknown>)?.name ?? "?"} | ${o.channel} | ${o.status} | ${o.created_at?.slice(0, 10)}`
  )
  .join("\n")}
--- END CRM DATA ---`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, message } = body as {
      sessionId?: string;
      message: string;
    };

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    // Get or create session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: session, error: sessionError } = await supabase
        .from("chat_sessions")
        .insert({ title: message.trim().slice(0, 80) })
        .select("id")
        .single();

      if (sessionError || !session) {
        // If table doesn't exist, work without persistence
        console.warn("[summary/chat] Could not create session:", sessionError?.message);
        currentSessionId = undefined;
      } else {
        currentSessionId = session.id;
      }
    }

    // Save user message
    if (currentSessionId) {
      await supabase.from("chat_messages").insert({
        session_id: currentSessionId,
        role: "user",
        content: message.trim(),
      });
    }

    // Load chat history for context
    let history: { role: string; content: string }[] = [];
    if (currentSessionId) {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", currentSessionId)
        .order("created_at", { ascending: true })
        .limit(30);
      history = (msgs ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      }));
    } else {
      history = [{ role: "user", content: message.trim() }];
    }

    // Fetch live CRM data
    const crmContext = await fetchCRMContext();

    // Build messages for LLM
    const llmMessages = [
      { role: "system" as const, content: `${SYSTEM_PROMPT}\n\n${crmContext}` },
      ...history.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
    ];

    const response = await callOpenRouter(llmMessages, { maxTokens: 4096 });

    // Save assistant response
    if (currentSessionId) {
      await supabase.from("chat_messages").insert({
        session_id: currentSessionId,
        role: "assistant",
        content: response,
      });

      // Update session timestamp
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", currentSessionId);
    }

    return NextResponse.json({
      sessionId: currentSessionId ?? null,
      response,
    });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    console.error("[summary/chat] error:", details);
    return NextResponse.json(
      { error: "Chat failed", details },
      { status: 500 }
    );
  }
}

// GET: Load chat sessions list or messages for a session
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (sessionId) {
    // Load messages for a session
    const { data: msgs, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(msgs ?? []);
  }

  // Load session list
  const { data: sessions, error } = await supabase
    .from("chat_sessions")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(sessions ?? []);
}
