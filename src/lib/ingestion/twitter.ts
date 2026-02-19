export interface TwitterProfile {
  id?: string;
  name?: string;
  username?: string;
  description?: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
  };
}

export interface TwitterTweet {
  id: string;
  text: string;
  created_at?: string;
}

export interface TwitterResult {
  profile: TwitterProfile;
  tweets: TwitterTweet[];
}

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const FETCH_TIMEOUT_MS = 10_000;

export async function fetchTwitterProfile(
  handle: string
): Promise<TwitterResult | null> {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) return null;

  const cleanHandle = handle.replace(/^@/, "");

  try {
    const profileRes = await fetchWithTimeout(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(cleanHandle)}?user.fields=description,public_metrics,profile_image_url`,
      { headers: { Authorization: `Bearer ${token}` } },
      FETCH_TIMEOUT_MS
    );
    if (!profileRes.ok) {
      const body = await profileRes.text();
      let detail = body;
      try {
        const j = JSON.parse(body);
        detail = j.errors?.[0]?.message ?? j.detail ?? body;
      } catch {
        // use body as-is
      }
      console.error("[twitter] Profile fetch failed:", profileRes.status, detail);
      return null;
    }
    const profileData = await profileRes.json();
    const profile: TwitterProfile = profileData.data ?? {};
    const id = profileData.data?.id;
    let tweets: TwitterTweet[] = [];
    if (id) {
      const tweetsRes = await fetchWithTimeout(
        `https://api.twitter.com/2/users/${id}/tweets?max_results=10&tweet.fields=created_at`,
        { headers: { Authorization: `Bearer ${token}` } },
        FETCH_TIMEOUT_MS
      );
      if (tweetsRes.ok) {
        const tweetsData = await tweetsRes.json();
        tweets = (tweetsData.data ?? []).map(
          (x: { id: string; text: string; created_at?: string }) => ({
            id: x.id,
            text: x.text,
            created_at: x.created_at,
          })
        );
      }
    }
    return { profile, tweets };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[twitter] API failed:", message);
    return null;
  }
}
