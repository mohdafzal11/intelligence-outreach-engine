import Anthropic from "@anthropic-ai/sdk";
import type { AIInsights, SuggestedContact } from "@/lib/types";

const SYSTEM_ANALYST = `You are an analyst for a web3 events company called HEM.
Analyze the provided raw research data and return a JSON object with:
- overview: 2-3 paragraph company brief
- category: array of relevant tags (DeFi, L2, Infrastructure, Gaming, etc)
- fit_score: number 0-100 rating sponsor fit
- fit_breakdown: { category_alignment: 0-25, budget_signals: 0-25, ecosystem_activity: 0-25, sponsorship_history: 0-25 }
- suggested_contacts: array of { name, likely_role, reasoning }
- key_hooks: array of 3 specific things to mention in outreach (recent tweet, event, announcement)

Return only valid JSON, no markdown or extra text.`;

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: key });
}

const CLEANUP_PROMPT = `Your previous response was not valid JSON. Return only a valid JSON object with:
- overview (string)
- category (array of strings)
- fit_score (number 0-100)
- fit_breakdown (object with category_alignment, budget_signals, ecosystem_activity, sponsorship_history as numbers 0-25)
- suggested_contacts (array of { name, likely_role, reasoning })
- key_hooks (array of strings)
No markdown, no code fences, no extra text. Only the raw JSON object.`;

function cleanJSONText(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^\s*```\s*$/i, "")
    .trim();
}

function parseJSON<T>(text: string): T {
  const cleaned = cleanJSONText(text);
  return JSON.parse(cleaned) as T;
}

function isValidAIInsights(obj: unknown): obj is AIInsights {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.overview === "string" &&
    Array.isArray(o.category) &&
    typeof o.fit_score === "number" &&
    (o.fit_breakdown == null || typeof o.fit_breakdown === "object") &&
    Array.isArray(o.suggested_contacts) &&
    Array.isArray(o.key_hooks)
  );
}

const MAX_INSIGHTS_RETRIES = 2;

export async function generateInsights(
  companyName: string,
  rawData: object
): Promise<AIInsights> {
  const client = getClient();
  const userContent = `Company: ${companyName}\n\nRaw research data:\n${JSON.stringify(rawData, null, 2)}`;
  let lastText = "";
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_INSIGHTS_RETRIES; attempt++) {
    const messages: { role: "user" | "assistant"; content: string }[] =
      attempt === 0
        ? [{ role: "user", content: userContent }]
        : [
            { role: "user", content: userContent },
            { role: "assistant", content: lastText },
            { role: "user", content: CLEANUP_PROMPT },
          ];

    const res = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_ANALYST,
      messages: messages as { role: "user"; content: string }[],
    });
    const text =
      res.content[0].type === "text"
        ? res.content[0].text
        : "";
    lastText = text;
    if (!text.trim()) {
      lastError = new Error("Empty AI response");
      continue;
    }
    try {
      const parsed = parseJSON<unknown>(text);
      if (isValidAIInsights(parsed)) {
        return parsed as AIInsights;
      }
      lastError = new Error("AI response missing required fields");
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("Failed to get valid insights JSON");
}

export interface OutreachParams {
  companyName: string;
  overview: string;
  person: { name: string; role?: string | null };
  channel: "email" | "linkedin_dm" | "linkedin" | "telegram" | "twitter" | "whatsapp";
  wrapperType: string;
  hooks: string[];
  /** Optional template snippets for the AI to reference (from outreach_templates) */
  templateSnippets?: string[];
}

export interface OutreachDraft {
  subject?: string;
  body: string;
}

const WRAPPER_TONES: Record<string, string> = {
  sponsor_devrel:
    "Tone: professional. Emphasize mutual value and visibility (brand exposure, developer community, thought leadership).",
  speaker_media:
    "Tone: invitational. Emphasize audience reach and topic relevance (speaking slot, media coverage, content alignment).",
  ecosystem:
    "Tone: collaborative. Emphasize partnership synergy and shared ecosystem goals (integration, co-marketing, community).",
  sponsorships:
    "Tone: commercial. Emphasize ROI and packages (tiers, benefits, deliverables, measurable outcomes).",
};

export async function generateOutreach(
  params: OutreachParams
): Promise<OutreachDraft> {
  const client = getClient();
  const channelInstructions: Record<string, string> = {
    email:
      "Write a short professional email. Include a subject line. Start your response with a line 'SUBJECT: ...' then a blank line, then the body.",
    linkedin_dm:
      "Write a short, casual LinkedIn DM (2-3 sentences). No subject line. Be concise and personable.",
    linkedin:
      "Write a short, casual LinkedIn DM (2-3 sentences). No subject line. Be concise and personable.",
    telegram:
      "Write a short Telegram message (2-4 sentences). No subject line. Slightly more casual than email.",
    twitter:
      "Write a short Twitter/X DM (2-3 sentences). No subject line. Casual and concise.",
    whatsapp:
      "Write a short WhatsApp message (2-4 sentences). No subject line. Friendly and concise.",
  };
  const wrapperTone =
    WRAPPER_TONES[params.wrapperType] ??
    `Wrapper: ${params.wrapperType}. Keep tone professional.`;
  const templateBlock =
    params.templateSnippets?.length
      ? `\nReference these example snippets (adapt to context, do not copy verbatim):\n${params.templateSnippets.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";
  const sys = `You are writing outreach for HEM (web3 events company). Channel: ${params.channel}. ${channelInstructions[params.channel] ?? channelInstructions.email}
Wrapper type: ${params.wrapperType}. ${wrapperTone} Use the key hooks naturally.${templateBlock}

Return only the draft: if email, first line SUBJECT: ... then body; otherwise just the message.`;
  const user = `Company: ${params.companyName}
Overview: ${params.overview}
Contact: ${params.person.name}${params.person.role ? ` (${params.person.role})` : ""}
Key hooks to use: ${params.hooks.join("; ")}`;

  const res = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: sys,
    messages: [{ role: "user", content: user }],
  });
  const text =
    res.content[0].type === "text" ? res.content[0].text : "";
  const subjectMatch = text.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : undefined;
  const body = subjectMatch
    ? text.replace(/SUBJECT:.*?\n+/i, "").trim()
    : text.trim();
  return { subject, body };
}

/** Ecosystem: pitch suggestions based on entity + priorities. */
export async function generatePitchSuggestions(params: {
  companyName: string;
  overview: string;
  wrapperType: string;
  priorities?: string[];
}): Promise<{ pitches: string[] }> {
  const client = getClient();
  const prioritiesText = params.priorities?.length
    ? `Ecosystem priorities to align with: ${params.priorities.join(", ")}.`
    : "Suggest 2-3 partnership pitch angles.";
  const res = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system:
      "You are a partnership lead for HEM (web3 events). Suggest short, specific pitch angles for outreach. Return only a JSON object with key 'pitches' (array of 2-4 strings). No markdown.",
    messages: [
      {
        role: "user",
        content: `Company: ${params.companyName}\nOverview: ${params.overview}\nWrapper: ${params.wrapperType}.\n${prioritiesText}`,
      },
    ],
  });
  const text = res.content[0].type === "text" ? res.content[0].text : "";
  try {
    const parsed = JSON.parse(text.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim()) as { pitches?: string[] };
    return { pitches: Array.isArray(parsed.pitches) ? parsed.pitches : [] };
  } catch {
    return { pitches: [] };
  }
}

/** Sponsorships: generate proposal text. */
export async function generateProposal(params: {
  companyName: string;
  overview: string;
  fitScore: number | null;
}): Promise<{ body: string }> {
  const client = getClient();
  const res = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system:
      "You write sponsorship proposals for HEM (web3 events). Include: brief intro, why they fit, tier options (Gold/Silver/Bronze), deliverables, and next steps. Professional tone.",
    messages: [
      {
        role: "user",
        content: `Company: ${params.companyName}\nOverview: ${params.overview}\nSponsor fit score: ${params.fitScore ?? "N/A"}\n\nWrite a 1-page proposal.`,
      },
    ],
  });
  const text = res.content[0].type === "text" ? res.content[0].text : "";
  return { body: text.trim() };
}

export async function generateFollowUp(params: {
  companyName: string;
  originalBody: string;
  followUpNumber: number;
}): Promise<{ subject?: string; body: string }> {
  const client = getClient();
  const res = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system:
      "You write brief, professional follow-up messages for HEM (web3 events). Keep it short. For email, start with SUBJECT: ... then body.",
    messages: [
      {
        role: "user",
        content: `Company: ${params.companyName}. Follow-up #${params.followUpNumber}. Original message:\n${params.originalBody}\n\nWrite a short follow-up.`,
      },
    ],
  });
  const text =
    res.content[0].type === "text" ? res.content[0].text : "";
  const subjectMatch = text.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : undefined;
  const body = subjectMatch
    ? text.replace(/SUBJECT:.*?\n+/i, "").trim()
    : text.trim();
  return { subject, body };
}
