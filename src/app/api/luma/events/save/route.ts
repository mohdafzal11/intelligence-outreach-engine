import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { scrapeLumaEventsFromUrls } from "@/lib/ingestion/luma-scraper";
import { getLumaUrlsForCompany } from "@/lib/luma-urls";

/**
 * POST /api/luma/events/save
 * Body: { companyName: string }
 * Luma URLs are configured in backend (luma-urls.ts). Scrapes and saves to luma_events.
 */
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { companyName } = body as { companyName?: string };
    const name = companyName?.trim();

    if (!name) {
      return NextResponse.json({ error: "companyName is required" }, { status: 400 });
    }

    const urls = getLumaUrlsForCompany(name);
    if (!urls?.length) {
      return NextResponse.json(
        { error: "No Luma links configured for this company. Add them in backend (src/lib/luma-urls.ts)." },
        { status: 400 }
      );
    }

    let events = await scrapeLumaEventsFromUrls(name, urls);

    if (events.length === 0 && urls.length > 0) {
      events = urls.map((url) => {
        const path = url.replace(/\/$/, "").split("/").filter(Boolean).pop() || "Event";
        const title = path.replace(/^[a-z]+\./, "").replace(/-/g, " ");
        return {
          title: title.length > 2 ? title : url,
          url,
          date: null,
          startAt: null,
          description: null,
          snippet: null,
          organizer: null,
        };
      });
    }

    let entityId: string | null = null;
    const { data: entity } = await supabase
      .from("entities")
      .select("id")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();
    if (entity?.id) entityId = entity.id;

    const rows = events.map((e) => ({
      company_name: name,
      entity_id: entityId,
      title: e.title,
      url: e.url,
      event_date: e.date,
      start_at: e.startAt,
      description: e.description,
      snippet: e.snippet,
      source_url: e.url,
    }));

    if (rows.length === 0) {
      return NextResponse.json({
        companyName: name,
        saved: 0,
        message: "No events could be scraped from the given URLs.",
      });
    }

    const { data: inserted, error } = await supabase.from("luma_events").insert(rows).select("id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      companyName: name,
      saved: inserted?.length ?? rows.length,
      events: events.length,
      message: `Saved ${inserted?.length ?? rows.length} events to database.`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Save failed", details: String(e) },
      { status: 500 }
    );
  }
}
