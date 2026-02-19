import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { callOpenRouter, cleanJSON } from "@/lib/openrouter";

const CHANNEL_GUIDELINES: Record<string, string> = {
  email:
    "Professional email. Include a subject line in the JSON. Greeting, 2-3 paragraphs, sign-off. Warm but professional.",
  linkedin:
    "LinkedIn message/InMail. Short, 2-3 paragraphs max. Reference their work. Conversational and professional.",
  twitter:
    "Twitter/X DM. Very short, under 280 characters if possible. Casual, punchy, direct. Use their @handle if known.",
  telegram:
    "Telegram message. Semi-casual, brief, 2-3 short paragraphs. Friendly and direct.",
  whatsapp:
    "WhatsApp message. Brief, personal, conversational. 2-3 short paragraphs max.",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entityId, channel, prompt } = body as {
      entityId?: string;
      channel?: string;
      prompt?: string;
    };

    if (!entityId || !channel) {
      return NextResponse.json(
        { error: "entityId and channel are required" },
        { status: 400 }
      );
    }

    // Fetch entity
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("id, name, overview, category, twitter_handle, website")
      .eq("id", entityId)
      .single();

    if (entityError || !entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const guideline = CHANNEL_GUIDELINES[channel] ?? "Professional outreach message.";
    const customInstruction = prompt?.trim()
      ? `\n\nAdditional instructions from the user:\n"${prompt.trim()}"`
      : "";

    const systemPrompt = `You are an outreach specialist for HEM (India Blockchain Week).
Generate a personalized outreach message for the specified channel.

Channel: ${channel}
Guidelines: ${guideline}
${customInstruction}

Return ONLY valid JSON (no markdown fences):
{
  "subject": "Subject line (only for email, omit for other channels)",
  "body": "The message body"
}`;

    const userData = JSON.stringify({
      name: entity.name,
      overview: entity.overview ?? "",
      categories: entity.category ?? [],
      twitter: entity.twitter_handle ?? "",
      website: entity.website ?? "",
    });

    const llmResponse = await callOpenRouter([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Generate a ${channel} outreach message for:\n${userData}`,
      },
    ]);

    let parsed: { subject?: string; body: string };
    try {
      parsed = JSON.parse(cleanJSON(llmResponse));
    } catch {
      parsed = { body: llmResponse };
    }

    return NextResponse.json({
      subject: parsed.subject ?? null,
      body: parsed.body ?? "",
      channel,
      entityId: entity.id,
      leadName: entity.name,
    });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    console.error("[outreach/generate-message] error:", details);
    return NextResponse.json(
      { error: "Message generation failed", details },
      { status: 500 }
    );
  }
}
