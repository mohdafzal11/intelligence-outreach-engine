import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const LLM_TIMEOUT_MS = 30_000;

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const model = options?.model ?? "openai/gpt-4o-mini";

  const res = await fetchWithTimeout(
    OPENROUTER_API_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nexus.local",
        "X-Title": "NEXUS Research Hub",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: 0.3,
      }),
    },
    LLM_TIMEOUT_MS
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Strip markdown code fences from LLM JSON output */
export function cleanJSON(text: string): string {
  return text
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
