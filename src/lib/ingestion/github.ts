import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const FETCH_TIMEOUT_MS = 10_000;

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  html_url: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface GitHubOrgResult {
  login: string;
  name: string | null;
  description: string | null;
  public_repos: number;
  [key: string]: unknown;
}

/**
 * Fetch GitHub org profile. Set GITHUB_TOKEN in env (optional, higher rate limit with token).
 */
export async function fetchGitHubOrg(orgLogin: string): Promise<GitHubOrgResult | null> {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetchWithTimeout(
      `https://api.github.com/orgs/${encodeURIComponent(orgLogin)}`,
      { headers },
      FETCH_TIMEOUT_MS
    );
    if (!res.ok) {
      console.warn("[github] Org fetch failed:", res.status, res.statusText);
      return null;
    }
    return (await res.json()) as GitHubOrgResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[github] Org error:", msg);
    return null;
  }
}

/**
 * List public repos for an org (for ecosystem activity signal).
 */
export async function fetchOrgRepos(orgLogin: string): Promise<GitHubRepo[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetchWithTimeout(
      `https://api.github.com/orgs/${encodeURIComponent(orgLogin)}/repos?sort=updated&per_page=10`,
      { headers },
      FETCH_TIMEOUT_MS
    );
    if (!res.ok) return [];
    const data = (await res.json()) as GitHubRepo[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
