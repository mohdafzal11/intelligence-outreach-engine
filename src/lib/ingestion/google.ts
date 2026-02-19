export interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
}

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const FETCH_TIMEOUT_MS = 10_000;

export async function searchGoogle(
  query: string
): Promise<GoogleSearchResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      api_key: apiKey,
      num: "10",
    });
    const res = await fetchWithTimeout(`https://serpapi.com/search?${params}`, undefined, FETCH_TIMEOUT_MS);
    if (!res.ok) {
      console.warn("[google] SerpAPI request failed:", res.status, res.statusText);
      return [];
    }
    const data = await res.json();
    const organic = data.organic_results ?? [];
    return organic.map((r: { title?: string; link?: string; snippet?: string }) => ({
      title: r.title ?? "",
      link: r.link ?? "",
      snippet: r.snippet ?? "",
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[google] SerpAPI error:", message);
    return [];
  }
}

export async function searchCompanyInfo(
  name: string
): Promise<GoogleSearchResult[]> {
  const [overview, sponsorship] = await Promise.all([
    searchGoogle(`${name} company overview funding`),
    searchGoogle(`${name} web3 sponsorship event partnership`),
  ]);
  const seen = new Set<string>();
  const combined: GoogleSearchResult[] = [];
  for (const r of [...overview, ...sponsorship]) {
    if (!seen.has(r.link)) {
      seen.add(r.link);
      combined.push(r);
    }
  }
  return combined;
}
