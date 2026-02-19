/**
 * Social API (api.socialapi.me) – fetch Twitter/X user data.
 * Set SOCIALAPI_API_KEY in .env.local. The key is from the SocialAPI dashboard, not the open-docs URL.
 * If your docs use a different path, set SOCIALAPI_BASE_URL or adjust the endpoint below.
 */

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { TwitterResult, TwitterProfile, TwitterTweet } from "./twitter";

const FETCH_TIMEOUT_MS = 15_000;

const BASE_URL = process.env.SOCIALAPI_BASE_URL?.trim() || "https://api.socialapi.me";

/** Normalize various possible API response shapes into our TwitterResult. */
function normalizeToTwitterResult(
  handle: string,
  data: unknown
): TwitterResult {
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  // Common patterns: data.user, data.profile, data.data, or root-level fields
  const user =
    (obj.user as Record<string, unknown>) ??
    (obj.profile as Record<string, unknown>) ??
    (obj.data as Record<string, unknown>) ??
    obj;

  const profile: TwitterProfile = {
    id: typeof user.id === "string" ? user.id : undefined,
    name: typeof user.name === "string" ? user.name : undefined,
    username:
      typeof user.username === "string"
        ? user.username
        : typeof user.screen_name === "string"
          ? user.screen_name
          : handle.replace(/^@/, ""),
    description: typeof user.description === "string" ? user.description : undefined,
    profile_image_url:
      typeof user.profile_image_url === "string"
        ? user.profile_image_url
        : typeof (user as Record<string, unknown>).avatar === "string"
          ? (user as Record<string, unknown>).avatar as string
          : undefined,
    public_metrics: undefined,
  };

  const metrics = user.public_metrics ?? user.metrics ?? user.followers_count;
  if (metrics && typeof metrics === "object") {
    profile.public_metrics = {
      followers_count:
        typeof (metrics as Record<string, unknown>).followers_count === "number"
          ? (metrics as Record<string, unknown>).followers_count as number
          : undefined,
      following_count:
        typeof (metrics as Record<string, unknown>).following_count === "number"
          ? (metrics as Record<string, unknown>).following_count as number
          : undefined,
      tweet_count:
        typeof (metrics as Record<string, unknown>).tweet_count === "number"
          ? (metrics as Record<string, unknown>).tweet_count as number
          : undefined,
    };
  } else if (typeof metrics === "number") {
    profile.public_metrics = { followers_count: metrics };
  }

  const rawTweets =
    (obj.tweets as unknown[]) ??
    (obj.data as unknown[]) ??
    (obj.recent_tweets as unknown[]) ??
    [];
  const tweets: TwitterTweet[] = rawTweets
    .filter((t): t is Record<string, unknown> => t != null && typeof t === "object")
    .map((t) => ({
      id: typeof t.id === "string" ? t.id : String(t.id ?? ""),
      text: typeof t.text === "string" ? t.text : (t.full_text as string) ?? "",
      created_at: typeof t.created_at === "string" ? t.created_at : undefined,
    }))
    .filter((t) => t.id || t.text);

  return { profile, tweets };
}

/**
 * Fetch one Twitter user by handle from Social API.
 * Returns data in the same shape as fetchTwitterProfile (TwitterResult) so callers can use either source.
 */
export async function fetchTwitterProfileFromSocialApi(
  handle: string
): Promise<TwitterResult | null> {
  const key = process.env.SOCIALAPI_API_KEY?.trim();
  if (!key) return null;

  const cleanHandle = handle.replace(/^@/, "").trim();
  if (!cleanHandle) return null;

  try {
    // Endpoint: override with SOCIALAPI_TWITTER_USER_PATH if your docs differ (e.g. /v1/twitter/user/:username)
    const pathTemplate =
      process.env.SOCIALAPI_TWITTER_USER_PATH?.trim() ||
      `/twitter/user/${encodeURIComponent(cleanHandle)}`;
    const path = pathTemplate.replace(/:username\b/, encodeURIComponent(cleanHandle));
    const url = path.startsWith("http") ? path : `${BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.SOCIALAPI_AUTH_HEADER === "X-API-Key") {
      headers["X-API-Key"] = key;
    } else {
      headers["Authorization"] = `Bearer ${key}`;
    }
    const res = await fetchWithTimeout(
      url,
      { method: "GET", headers },
      FETCH_TIMEOUT_MS
    );

    if (!res.ok) {
      const body = await res.text();
      let detail = body;
      try {
        const j = JSON.parse(body);
        detail = String(
          (j as Record<string, unknown>).message ??
          (j as Record<string, unknown>).error ??
          (Array.isArray((j as Record<string, unknown>).errors)
            ? ((j as Record<string, unknown>).errors as unknown[])?.[0]
            : null) ??
          body
        );
      } catch {
        // use body as-is
      }
      console.error("[social-api] Profile fetch failed:", res.status, detail);
      return null;
    }

    const data = await res.json();
    return normalizeToTwitterResult(cleanHandle, data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[social-api] Request failed:", message);
    return null;
  }
}

/**
 * Fetch multiple Twitter users by handle. Returns a map of handle -> result (or null if failed).
 */
export async function fetchTwitterProfilesFromSocialApi(
  handles: string[]
): Promise<Map<string, TwitterResult | null>> {
  const key = process.env.SOCIALAPI_API_KEY?.trim();
  const result = new Map<string, TwitterResult | null>();
  if (!key) {
    handles.forEach((h) => result.set(h.replace(/^@/, ""), null));
    return result;
  }

  const uniqueHandles = Array.from(
    new Set(handles.map((h) => h.replace(/^@/, "").trim()).filter(Boolean))
  );
  const settled = await Promise.allSettled(
    uniqueHandles.map(async (h) => fetchTwitterProfileFromSocialApi(h))
  );
  uniqueHandles.forEach((h, i) => {
    const s = settled[i];
    result.set(
      h,
      s?.status === "fulfilled" ? s.value : null
    );
  });
  return result;
}

export function hasSocialApiKey(): boolean {
  return !!process.env.SOCIALAPI_API_KEY?.trim();
}

/* ------------------------------------------------------------------ */
/*  Twitter Search (keyword/query search, NOT user profile lookup)    */
/* ------------------------------------------------------------------ */

export interface TwitterSearchResult {
  text: string;
  user: { name: string; username: string };
  created_at?: string;
}

export async function searchTwitter(
  query: string
): Promise<TwitterSearchResult[]> {
  const key = process.env.SOCIALAPI_API_KEY?.trim();
  if (!key) return [];

  try {
    const url = `${BASE_URL.replace(/\/$/, "")}/twitter/search?query=${encodeURIComponent(query)}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    };

    const res = await fetchWithTimeout(url, { method: "GET", headers }, FETCH_TIMEOUT_MS);
    if (!res.ok) {
      console.warn("[social-api] Twitter search failed:", res.status);
      return [];
    }

    const data = await res.json();
    const tweets: unknown[] =
      (data as Record<string, unknown>).tweets as unknown[] ??
      (data as Record<string, unknown>).data as unknown[] ??
      (data as Record<string, unknown>).results as unknown[] ??
      (Array.isArray(data) ? data : []);

    return tweets
      .filter((t): t is Record<string, unknown> => t != null && typeof t === "object")
      .map((t) => ({
        text: (typeof t.text === "string" ? t.text : (t.full_text as string) ?? "") as string,
        user: {
          name: ((t.user as Record<string, unknown>)?.name as string) ?? "",
          username:
            ((t.user as Record<string, unknown>)?.screen_name as string) ??
            ((t.user as Record<string, unknown>)?.username as string) ??
            "",
        },
        created_at: typeof t.created_at === "string" ? t.created_at : undefined,
      }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[social-api] Twitter search error:", message);
    return [];
  }
}
