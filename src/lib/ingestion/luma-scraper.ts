import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { searchGoogle } from "./google";
import { scrapeWebsite } from "./website";

const FETCH_TIMEOUT_MS = 12_000;

export interface LumaScrapedEvent {
  title: string;
  url: string;
  date: string | null;
  startAt: string | null; // ISO if parsed
  description: string | null;
  snippet: string | null;
  organizer?: string | null;
}

const LUMA_DOMAINS = ["lu.ma", "luma.com"];
const TWELVE_MONTHS_AGO = new Date();
TWELVE_MONTHS_AGO.setFullYear(TWELVE_MONTHS_AGO.getFullYear() - 1);

function isLumaUrl(link: string): boolean {
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const ok = LUMA_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
    if (!ok) return false;
    const path = u.pathname.replace(/\/$/, "");
    return path.length >= 1;
  } catch {
    return false;
  }
}

function isLumaEventUrl(link: string): boolean {
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const ok = LUMA_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
    if (!ok) return false;
    const path = u.pathname.replace(/\/$/, "");
    return path.length > 1 && path.split("/").length >= 2;
  } catch {
    return false;
  }
}

function parseDateFromContent(content: string): { date: string | null; startAt: string | null } {
  // ISO date
  const isoMatch = content.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?/);
  if (isoMatch) {
    const d = new Date(isoMatch[0]);
    if (!isNaN(d.getTime()) && d >= TWELVE_MONTHS_AGO) {
      return { date: d.toISOString().slice(0, 10), startAt: d.toISOString() };
    }
  }
  // "Month DD, YYYY" or "DD Month YYYY"
  const longMatch = content.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i);
  if (longMatch) {
    const d = new Date(longMatch[0]);
    if (!isNaN(d.getTime()) && d >= TWELVE_MONTHS_AGO) {
      return { date: d.toISOString().slice(0, 10), startAt: d.toISOString() };
    }
  }
  // "YYYY-MM-DD"
  const shortMatch = content.match(/\d{4}-\d{2}-\d{2}/);
  if (shortMatch) {
    const d = new Date(shortMatch[0]);
    if (!isNaN(d.getTime()) && d >= TWELVE_MONTHS_AGO) {
      return { date: shortMatch[0], startAt: d.toISOString() };
    }
  }
  return { date: null, startAt: null };
}

function extractTitleFromContent(content: string, fallback: string): string {
  const firstLine = content.split("\n").find((l) => l.trim().length > 0);
  if (firstLine) {
    const cleaned = firstLine.replace(/^#+\s*/, "").trim();
    if (cleaned.length > 2 && cleaned.length < 200) return cleaned;
  }
  return fallback;
}

/**
 * Scrape Luma for events related to a company name (hackathons, meetups, events) in the last 12 months.
 * Uses Google/SerpAPI to find lu.ma links, then fetches each event page (Firecrawl/Jina) and parses title/date/description.
 * Requires SERPAPI_API_KEY. Firecrawl/Jina optional but recommended for page fetch.
 */
export async function scrapeLumaEventsByCompany(companyName: string): Promise<LumaScrapedEvent[]> {
  const trimmed = companyName.trim();
  if (!trimmed) return [];

  const queries = [
    `"${trimmed}" hackathon site:lu.ma`,
    `"${trimmed}" event OR meetup site:lu.ma`,
    `${trimmed} lu.ma events`,
  ];

  const allResults: { link: string; title: string; snippet: string }[] = [];
  const seenLinks = new Set<string>();

  for (const q of queries) {
    const results = await searchGoogle(q);
    for (const r of results) {
      if (!isLumaEventUrl(r.link) || seenLinks.has(r.link)) continue;
      seenLinks.add(r.link);
      allResults.push({ link: r.link, title: r.title, snippet: r.snippet });
    }
  }

  const events: LumaScrapedEvent[] = [];
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  for (const { link, title, snippet } of allResults) {
    try {
      const page = await scrapeWebsite(link);
      const content = page?.content ?? "";
      const { date, startAt } = parseDateFromContent(content);
      const parsedTitle = extractTitleFromContent(content, title);
      const descMatch = content.match(/(?:description|about|details?)[:\s]*\n?([^\n]{20,500})/i);
      const description = descMatch ? descMatch[1].trim() : null;

      const now = new Date();
      const eventDate = startAt ? new Date(startAt) : null;
      if (eventDate && (eventDate < twelveMonthsAgo || eventDate > now)) continue;

      events.push({
        title: parsedTitle,
        url: link,
        date,
        startAt,
        description,
        snippet: snippet || null,
        organizer: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[luma-scraper] Failed to fetch", link, msg);
      events.push({
        title,
        url: link,
        date: null,
        startAt: null,
        description: null,
        snippet: snippet || null,
        organizer: null,
      });
    }
  }

  events.sort((a, b) => {
    if (!a.startAt) return 1;
    if (!b.startAt) return -1;
    return new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
  });

  return events;
}

function parseDateFromContentAny(content: string): { date: string | null; startAt: string | null } {
  const isoMatch = content.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?/);
  if (isoMatch) {
    const d = new Date(isoMatch[0]);
    if (!isNaN(d.getTime())) return { date: d.toISOString().slice(0, 10), startAt: d.toISOString() };
  }
  const longMatch = content.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i);
  if (longMatch) {
    const d = new Date(longMatch[0]);
    if (!isNaN(d.getTime())) return { date: d.toISOString().slice(0, 10), startAt: d.toISOString() };
  }
  const shortMatch = content.match(/\d{4}-\d{2}-\d{2}/);
  if (shortMatch) {
    const d = new Date(shortMatch[0]);
    if (!isNaN(d.getTime())) return { date: shortMatch[0], startAt: d.toISOString() };
  }
  return { date: null, startAt: null };
}

/** Extract lu.ma / luma.com event links from page content (markdown or HTML-like). */
function extractEventLinksFromContent(content: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const found = new Set<string>();
  // Match href="...", ](url), or plain https://lu.ma/... / https://luma.com/...
  const patterns = [
    /https?:\/\/(?:www\.)?(?:lu\.ma|luma\.com)\/[^\s"')\]>]+/gi,
    /(?:href|url)=["']([^"']*(?:lu\.ma|luma\.com)[^"']*)["']/gi,
    /\]\((https?:\/\/(?:www\.)?(?:lu\.ma|luma\.com)[^)]+)\)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(content)) !== null) {
      const raw = (m[1] ?? m[0]).replace(/[)\]>'"\s]+$/, "");
      try {
        const u = new URL(raw, base);
        if (isLumaUrl(u.href) && u.pathname.length > 1) {
          const key = u.href.replace(/\/$/, "").toLowerCase();
          if (!found.has(key)) found.add(key);
        }
      } catch {
        // ignore
      }
    }
  }
  return Array.from(found);
}

/**
 * Scrape events from a list of Luma URLs (lu.ma or luma.com) and return events for saving to DB.
 * Accepts calendar pages (e.g. luma.com/Polygonlabs) and profile pages; will scrape the page
 * and extract event links if present, or save the page as one event.
 */
export async function scrapeLumaEventsFromUrls(
  companyName: string,
  urls: string[]
): Promise<LumaScrapedEvent[]> {
  const trimmed = companyName.trim();
  if (!trimmed) return [];

  const normalized = urls
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && isLumaUrl(u));
  const seen = new Set<string>();
  const unique = normalized.filter((u) => {
    const key = u.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const allEventUrls: string[] = [];
  for (const link of unique) {
    try {
      const page = await scrapeWebsite(link);
      const content = page?.content ?? "";
      const subLinks = extractEventLinksFromContent(content, link);
      if (subLinks.length > 0) {
        subLinks.forEach((s) => {
          const k = s.replace(/\/$/, "").toLowerCase();
          if (!seen.has(k)) {
            seen.add(k);
            allEventUrls.push(s);
          }
        });
      } else {
        allEventUrls.push(link);
      }
    } catch {
      allEventUrls.push(link);
    }
  }

  const events: LumaScrapedEvent[] = [];
  const seenEvents = new Set<string>();

  if (allEventUrls.length === 0) {
    return events;
  }

  for (const link of allEventUrls) {
    const linkKey = link.replace(/\/$/, "").toLowerCase();
    if (seenEvents.has(linkKey)) continue;
    seenEvents.add(linkKey);

    try {
      const page = await scrapeWebsite(link);
      const content = page?.content ?? "";
      const { date, startAt } = parseDateFromContentAny(content);
      const fallbackTitle = page?.title || new URL(link).pathname.split("/").filter(Boolean).pop() || "Event";
      const title = extractTitleFromContent(content, fallbackTitle);
      const descMatch = content.match(/(?:description|about|details?)[:\s]*\n?([^\n]{20,500})/i);
      const description = descMatch ? descMatch[1].trim() : null;

      events.push({
        title: title.slice(0, 500),
        url: link,
        date,
        startAt,
        description: description?.slice(0, 2000) ?? null,
        snippet: null,
        organizer: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[luma-scraper] Failed to fetch", link, msg);
      events.push({
        title: new URL(link).pathname.split("/").filter(Boolean).pop() || "Event",
        url: link,
        date: null,
        startAt: null,
        description: null,
        snippet: null,
        organizer: null,
      });
    }
  }

  events.sort((a, b) => {
    if (!a.startAt) return 1;
    if (!b.startAt) return -1;
    return new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
  });

  return events;
}
