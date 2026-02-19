import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const FETCH_TIMEOUT_MS = 10_000;

export interface ProxycurlCompany {
  name?: string;
  description?: string;
  industry?: string;
  company_size?: string;
  headquarters_location?: string;
  funding_data?: unknown;
  specialties?: string[];
  [key: string]: unknown;
}

/**
 * Resolve company domain to LinkedIn URL, then fetch company profile.
 * Set PROXYCURL_API_KEY in env.
 */
export async function enrichCompanyByDomain(
  domain: string
): Promise<ProxycurlCompany | null> {
  const key = process.env.PROXYCURL_API_KEY;
  if (!key) return null;

  const cleanDomain = domain.replace(/^https?:\/\//i, "").split("/")[0];

  try {
    const resolveRes = await fetchWithTimeout(
      `https://nubela.co/proxycurl/api/linkedin/company/resolve?company_domain=${encodeURIComponent(cleanDomain)}`,
      { headers: { Authorization: `Bearer ${key}` } },
      FETCH_TIMEOUT_MS
    );
    if (!resolveRes.ok) return null;
    const resolveData = (await resolveRes.json()) as { url?: string };
    const linkedInUrl = resolveData?.url;
    if (!linkedInUrl) return null;

    const profileRes = await fetchWithTimeout(
      `https://nubela.co/proxycurl/api/v2/linkedin/company?url=${encodeURIComponent(linkedInUrl)}`,
      { headers: { Authorization: `Bearer ${key}` } },
      FETCH_TIMEOUT_MS
    );
    if (!profileRes.ok) {
      console.warn("[proxycurl] Profile fetch failed:", profileRes.status);
      return null;
    }
    const data = await profileRes.json();
    return data as ProxycurlCompany;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[proxycurl] Error:", msg);
    return null;
  }
}
