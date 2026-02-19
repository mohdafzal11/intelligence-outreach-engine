import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const FETCH_TIMEOUT_MS = 10_000;
const BASE = "https://public-api.luma.com";

export interface LumaEvent {
  id: string;
  name?: string;
  start_at?: string;
  end_at?: string;
  description?: string;
  [key: string]: unknown;
}

export interface LumaListEventsResponse {
  entries?: { event?: LumaEvent }[];
  next_cursor?: string;
}

/**
 * List upcoming events from your Luma calendar (ecosystem activity).
 * Set LUMA_API_KEY in env. Requires Luma calendar API key.
 */
export async function listLumaEvents(options?: {
  after?: string; // ISO datetime
  before?: string;
  limit?: number;
}): Promise<LumaEvent[]> {
  const key = process.env.LUMA_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams();
  if (options?.after) params.set("after", options.after);
  if (options?.before) params.set("before", options.before);
  if (options?.limit) params.set("pagination_limit", String(options.limit));

  try {
    const url = `${BASE}/v1/calendar/list-events${params.toString() ? `?${params}` : ""}`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      },
      FETCH_TIMEOUT_MS
    );
    if (!res.ok) {
      console.warn("[luma] List events failed:", res.status, res.statusText);
      return [];
    }
    const data = (await res.json()) as LumaListEventsResponse;
    const entries = data.entries ?? [];
    return entries.map((e) => e.event).filter((e): e is LumaEvent => !!e);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[luma] Error:", msg);
    return [];
  }
}
