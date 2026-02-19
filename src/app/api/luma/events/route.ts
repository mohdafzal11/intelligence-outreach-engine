import { NextResponse } from "next/server";
import { scrapeLumaEventsByCompany } from "@/lib/ingestion/luma-scraper";

/**
 * GET /api/luma/events?company=Polygon+Labs
 * Scrapes Luma for events (hackathons, meetups) related to the company in the last 12 months.
 * Requires SERPAPI_API_KEY. Uses Firecrawl/Jina if available for page fetch.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company")?.trim();
  if (!company) {
    return NextResponse.json(
      { error: "Query param 'company' required (e.g. ?company=Polygon+Labs)" },
      { status: 400 }
    );
  }

  try {
    const events = await scrapeLumaEventsByCompany(company);
    return NextResponse.json({ company, events, count: events.length });
  } catch (e) {
    return NextResponse.json(
      { error: "Luma scrape failed", details: String(e) },
      { status: 500 }
    );
  }
}
