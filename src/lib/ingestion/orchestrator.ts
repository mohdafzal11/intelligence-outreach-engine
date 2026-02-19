import { scrapeWebsite } from "./website";
import { searchCompanyInfo, GoogleSearchResult } from "./google";
import { fetchTwitterProfile, TwitterResult } from "./twitter";
import { fetchTwitterProfileFromSocialApi, hasSocialApiKey } from "./social-api";
import { enrichCompanyByDomain, ProxycurlCompany } from "./proxycurl";
import { fetchGitHubOrg, fetchOrgRepos, GitHubOrgResult, GitHubRepo } from "./github";
import { listLumaEvents, LumaEvent } from "./luma";
import { scrapeLumaEventsByCompany, LumaScrapedEvent } from "./luma-scraper";

export interface ResearchInput {
  name: string;
  website?: string | null;
  twitterHandle?: string | null;
  /** Optional: run Proxycurl, GitHub, Luma, Luma scraper (enrichment). */
  enrich?: boolean;
}

export interface ResearchResult {
  website: Awaited<ReturnType<typeof scrapeWebsite>>;
  google: GoogleSearchResult[];
  twitter: TwitterResult | null;
  proxycurl: ProxycurlCompany | null;
  github: { org: GitHubOrgResult | null; repos: GitHubRepo[] };
  luma: LumaEvent[];
  /** Events from lu.ma related to company (hackathons, meetups) – last 12 months. */
  lumaScraped: LumaScrapedEvent[];
  errors: string[];
}

export async function researchCompany(
  input: ResearchInput
): Promise<ResearchResult> {
  const errors: string[] = [];
  const fetchTwitter = hasSocialApiKey()
    ? fetchTwitterProfileFromSocialApi
    : fetchTwitterProfile;

  const [websiteSettled, googleSettled, twitterSettled] = await Promise.allSettled([
    input.website ? scrapeWebsite(input.website) : Promise.resolve(null),
    searchCompanyInfo(input.name),
    input.twitterHandle
      ? fetchTwitter(input.twitterHandle)
      : Promise.resolve(null),
  ]);

  const website =
    websiteSettled.status === "fulfilled" ? websiteSettled.value : null;
  if (websiteSettled.status === "rejected")
    errors.push(`Website: ${websiteSettled.reason?.message ?? "Failed"}`);

  const google =
    googleSettled.status === "fulfilled" ? googleSettled.value : [];
  if (googleSettled.status === "rejected")
    errors.push(`Google: ${googleSettled.reason?.message ?? "Failed"}`);

  const twitter =
    twitterSettled.status === "fulfilled" ? twitterSettled.value : null;
  if (twitterSettled.status === "rejected")
    errors.push(`Twitter: ${twitterSettled.reason?.message ?? "Failed"}`);

  let proxycurl: ProxycurlCompany | null = null;
  let github: { org: GitHubOrgResult | null; repos: GitHubRepo[] } = { org: null, repos: [] };
  let luma: LumaEvent[] = [];
  let lumaScraped: LumaScrapedEvent[] = [];

  if (input.enrich !== false) {
    const domain = input.website
      ? input.website.replace(/^https?:\/\//i, "").split("/")[0]
      : null;
    const [proxycurlSettled, githubSettled, lumaSettled, lumaScrapedSettled] = await Promise.allSettled([
      domain ? enrichCompanyByDomain(domain) : Promise.resolve(null),
      domain ? (async () => {
        const org = await fetchGitHubOrg(domain.split(".")[0]);
        const repos = org ? await fetchOrgRepos(domain.split(".")[0]) : [];
        return { org, repos };
      })() : Promise.resolve({ org: null, repos: [] }),
      listLumaEvents({ after: new Date().toISOString(), limit: 20 }),
      scrapeLumaEventsByCompany(input.name),
    ]);

    proxycurl = proxycurlSettled.status === "fulfilled" ? proxycurlSettled.value : null;
    github = githubSettled.status === "fulfilled" ? githubSettled.value : { org: null, repos: [] };
    luma = lumaSettled.status === "fulfilled" ? lumaSettled.value : [];
    lumaScraped = lumaScrapedSettled.status === "fulfilled" ? lumaScrapedSettled.value : [];
  }

  return { website, google, twitter, proxycurl, github, luma, lumaScraped, errors };
}
