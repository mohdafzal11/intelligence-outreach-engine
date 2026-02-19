import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export interface ScrapeResult {
  content: string;
  title: string;
}

const FETCH_TIMEOUT_MS = 10_000;

export async function scrapeWebsite(url: string): Promise<ScrapeResult | null> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const cleanUrl = url.startsWith("http") ? url : `https://${url}`;

  if (firecrawlKey) {
    try {
      const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({ url: cleanUrl }),
      }, FETCH_TIMEOUT_MS);
      if (!res.ok) {
        const err = new Error(`Firecrawl ${res.status}: ${res.statusText}`);
        console.warn("[website] Firecrawl failed, falling back to Jina:", err.message);
        throw err;
      }
      const data = await res.json();
      const content =
        data.data?.markdown ?? data.data?.content ?? "";
      const title = data.data?.metadata?.title ?? "";
      if (content) return { content, title };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("Firecrawl")) {
        console.warn("[website] Firecrawl failed, falling back to Jina:", message);
      }
      // fall through to Jina
    }
  }

  try {
    const jinaUrl = `https://r.jina.ai/${cleanUrl}`;
    const res = await fetchWithTimeout(jinaUrl, {
      headers: { "X-Return-Format": "markdown" },
    }, FETCH_TIMEOUT_MS);
    if (!res.ok) {
      console.warn("[website] Jina Reader failed:", res.status, res.statusText);
      return null;
    }
    const text = await res.text();
    const titleMatch = text.match(/^#\s+(.+)$/m);
    return {
      content: text,
      title: titleMatch ? titleMatch[1].trim() : "",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[website] Jina Reader error:", message);
    return null;
  }
}
