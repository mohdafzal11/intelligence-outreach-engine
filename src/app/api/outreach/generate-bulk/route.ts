import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { callOpenRouter, cleanJSON } from "@/lib/openrouter";

const CHANNELS = ["email", "linkedin", "twitter", "telegram", "whatsapp"] as const;

const CHANNEL_GUIDELINES: Record<string, string> = {
  email: "Professional email. Include subject line, greeting, 2-3 paragraphs, and sign-off. Formal but warm tone.",
  linkedin: "LinkedIn message/InMail. Short, professional, 2-3 paragraphs max. Reference their work. Conversational.",
  twitter: "Twitter/X DM or public reply. Very short (under 280 chars for public, up to 500 for DM). Casual, punchy.",
  telegram: "Telegram message. Semi-casual, brief, direct. 2-3 short paragraphs. Friendly tone.",
  whatsapp: "WhatsApp message. Brief, personal, conversational. 2-3 short paragraphs.",
};

function buildPrompt(channels: string[], customPrompt?: string): string {
  const channelSpecs = channels
    .map((c) => `- ${c}: ${CHANNEL_GUIDELINES[c] ?? "Professional message"}`)
    .join("\n");

  const customInstruction = customPrompt
    ? `\n\nThe user has provided these additional instructions for the messages:\n"${customPrompt}"\nFollow these instructions closely when generating messages.`
    : "";

  return `You are an outreach specialist for HEM (India Blockchain Week).
Generate personalized outreach messages for each lead across the specified channels.
${customInstruction}

Channel guidelines:
${channelSpecs}

For each lead, generate a message for EACH of the specified channels.
Personalize based on the lead's company, overview, and categories.

Return ONLY valid JSON (no markdown fences):
{
  "messages": [
    {
      "leadName": "Company name",
      "entityId": "the entity id",
      "channels": {
        "email": { "subject": "Subject line", "body": "Email body..." },
        "linkedin": { "body": "LinkedIn message..." },
        "twitter": { "body": "Tweet/DM text..." },
        "telegram": { "body": "Telegram message..." },
        "whatsapp": { "body": "WhatsApp message..." }
      }
    }
  ]
}

Only include the channels that were requested. Make each message unique and personalized.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const channels: string[] = Array.isArray(body?.channels)
      ? body.channels.filter((c: string) => CHANNELS.includes(c as (typeof CHANNELS)[number]))
      : [...CHANNELS];
    const customPrompt: string | undefined = body?.prompt?.trim() || undefined;
    const limit = Math.min(body?.limit ?? 10, 20);

    if (channels.length === 0) {
      return NextResponse.json({ error: "At least one channel required" }, { status: 400 });
    }

    // Fetch leads from pipeline with entity data
    const { data: pipelineRows, error: pipelineError } = await supabase
      .from("pipeline")
      .select("id, entity_id, wrapper_type, stage, entities(id, name, overview, category, twitter_handle, website)")
      .in("stage", ["lead", "contacted"])
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (pipelineError) {
      return NextResponse.json({ error: "Failed to fetch leads", details: pipelineError.message }, { status: 500 });
    }

    const leads = (pipelineRows ?? [])
      .filter((r: Record<string, unknown>) => r.entities)
      .map((r: Record<string, unknown>) => {
        const entity = r.entities as Record<string, unknown>;
        return {
          entityId: entity.id as string,
          name: entity.name as string,
          overview: (entity.overview as string) ?? "",
          category: (entity.category as string[]) ?? [],
          twitter: (entity.twitter_handle as string) ?? "",
          website: (entity.website as string) ?? "",
          wrapperType: r.wrapper_type as string,
        };
      });

    if (leads.length === 0) {
      return NextResponse.json({ messages: [], leadCount: 0 });
    }

    // Build data for LLM
    const leadsData = JSON.stringify(
      leads.map((l) => ({
        entityId: l.entityId,
        name: l.name,
        overview: l.overview.slice(0, 500),
        categories: l.category,
        twitter: l.twitter,
        website: l.website,
      }))
    );

    const llmResponse = await callOpenRouter(
      [
        { role: "system", content: buildPrompt(channels, customPrompt) },
        {
          role: "user",
          content: `Generate outreach messages for these ${leads.length} leads across channels [${channels.join(", ")}]:\n\n${leadsData}`,
        },
      ],
      { maxTokens: 8192 }
    );

    let parsed: { messages: Record<string, unknown>[] };
    try {
      parsed = JSON.parse(cleanJSON(llmResponse));
    } catch {
      parsed = { messages: [] };
    }

    return NextResponse.json({
      messages: parsed.messages ?? [],
      leadCount: leads.length,
      channels,
    });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    console.error("[outreach/generate-bulk] error:", details);
    return NextResponse.json({ error: "Message generation failed", details }, { status: 500 });
  }
}
