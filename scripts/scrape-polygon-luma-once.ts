/**
 * One-time: Scrape Polygon Luma events (last 12 months) and save to DB.
 * Run: npx tsx scripts/scrape-polygon-luma-once.ts
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: FIRECRAWL_API_KEY or Jina for scraping.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
for (const f of [".env.local", ".env"]) {
  const p = resolve(root, f);
  if (existsSync(p)) {
    const content = readFileSync(p, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
    break;
  }
}

const TWELVE_MONTHS_AGO = new Date();
TWELVE_MONTHS_AGO.setFullYear(TWELVE_MONTHS_AGO.getFullYear() - 1);
const NOW = new Date();

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { scrapeLumaEventsFromUrls } = await import("../src/lib/ingestion/luma-scraper");
  const { getLumaUrlsForCompany } = await import("../src/lib/luma-urls");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const companyName = "Polygon";
  const lumaUrls = getLumaUrlsForCompany(companyName);
  if (!lumaUrls?.length) {
    console.error("No Luma URLs configured for Polygon. Check src/lib/luma-urls.ts");
    process.exit(1);
  }

  console.log("Scraping Luma for", companyName, "(", lumaUrls.length, "URLs )...");
  const all = await scrapeLumaEventsFromUrls(companyName, lumaUrls);
  const last12Months = all.filter((e) => {
    if (!e.startAt) return true;
    const d = new Date(e.startAt);
    return d >= TWELVE_MONTHS_AGO && d <= NOW;
  });
  console.log("Total scraped:", all.length, "| In last 12 months:", last12Months.length);

  if (last12Months.length === 0) {
    console.log("No events in last 12 months to save.");
    return;
  }

  const supabase = createClient(url, key);
  const { data: entity } = await supabase
    .from("entities")
    .select("id")
    .or("name.ilike.%Polygon%")
    .limit(1)
    .maybeSingle();

  const rows = last12Months.map((e) => ({
    company_name: companyName,
    entity_id: entity?.id ?? null,
    title: e.title,
    url: e.url,
    event_date: e.date,
    start_at: e.startAt,
    description: e.description,
    snippet: e.snippet,
    source_url: e.url,
  }));

  const { data: inserted, error } = await supabase.from("luma_events").insert(rows).select("id");
  if (error) {
    console.error("DB error:", error.message);
    if (error.message?.includes("does not exist")) {
      console.error("Run supabase/luma_events_table.sql in Supabase SQL Editor first.");
    }
    process.exit(1);
  }

  console.log("Saved", inserted?.length ?? rows.length, "events to luma_events. Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
