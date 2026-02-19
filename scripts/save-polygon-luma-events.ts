/**
 * One-off: Scrape Luma URLs for Polygon Labs and save to luma_events table.
 * Run from project root: npx tsx scripts/save-polygon-luma-events.ts
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
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

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { scrapeLumaEventsFromUrls } = await import("../src/lib/ingestion/luma-scraper");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const companyName = "Polygon Labs";
  const lumaUrls = [
    "https://luma.com/Polygonlabs",
    "https://luma.com/user/bfp",
  ];

  console.log("Scraping Luma URLs for", companyName, "...");
  const events = await scrapeLumaEventsFromUrls(companyName, lumaUrls);
  console.log("Scraped", events.length, "events");

  if (events.length === 0) {
    console.log("No events to save.");
    return;
  }

  const supabase = createClient(url, key);
  const { data: entity } = await supabase
    .from("entities")
    .select("id")
    .or("name.ilike.%Polygon Labs%,name.ilike.%Polygon%")
    .limit(1)
    .maybeSingle();

  const rows = events.map((e) => ({
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
      console.error("Run the luma_events table SQL in Supabase first: supabase/luma_events_table.sql");
    }
    process.exit(1);
  }

  console.log("Saved", inserted?.length ?? rows.length, "events to luma_events.");
  console.log("Search for 'Polygon' or 'Polygon Labs' in the Research tab to see them.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
