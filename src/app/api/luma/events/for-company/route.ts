import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { scrapeLumaEventsFromUrls } from "@/lib/ingestion/luma-scraper";
import { getLumaUrlsForCompany } from "@/lib/luma-urls";

/**
 * GET /api/luma/events/for-company?company=MyCompany
 * 1. Return saved events from DB if any.
 * 2. Else get Luma URL for company (lu.ma/{company}), scrape events, save to DB, return.
 */
export async function GET(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company")?.trim();

  if (!company) {
    return NextResponse.json(
      { error: "Query param 'company' required" },
      { status: 400 }
    );
  }

  const { data: saved, error: savedError } = await supabase
    .from("luma_events")
    .select("*")
    .ilike("company_name", `%${company}%`)
    .order("start_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (savedError) {
    return NextResponse.json({ error: savedError.message }, { status: 500 });
  }

  if (saved?.length) {
    return NextResponse.json(saved);
  }

  let entityId: string | null = null;
  const { data: entity } = await supabase
    .from("entities")
    .select("id")
    .ilike("name", company)
    .limit(1)
    .maybeSingle();
  if (entity?.id) entityId = entity.id;

  try {
    const urls = getLumaUrlsForCompany(company);
    if (!urls?.length) {
      return NextResponse.json([]);
    }
    let events = await scrapeLumaEventsFromUrls(company, urls);
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
    const rows = events
      .filter((e) => e?.url?.trim())
      .map((e) => ({
        company_name: company,
        entity_id: entityId,
        title: (e.title ?? "").trim() || "Event",
        url: e.url.trim(),
        event_date: e.date ?? null,
        start_at: e.startAt ?? null,
        description: e.description ?? null,
        snippet: e.snippet ?? null,
        source_url: e.url.trim(),
      }));

    const urlsToCheck = Array.from(new Set(rows.map((r) => r.url)));
    const existingUrls = new Set<string>();
    if (urlsToCheck.length > 0) {
      const { data: existing } = await supabase
        .from("luma_events")
        .select("url")
        .in("url", urlsToCheck);
      for (const row of existing ?? []) {
        if (row?.url) existingUrls.add(row.url);
      }
    }
    const rowsToInsert = rows.filter((r) => !existingUrls.has(r.url));

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("luma_events")
        .insert(rowsToInsert);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    const { data: allForCompany, error: fetchError } = await supabase
      .from("luma_events")
      .select("*")
      .ilike("company_name", `%${company}%`)
      .order("start_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    return NextResponse.json(allForCompany ?? []);
  } catch (e) {
    return NextResponse.json(
      { error: "Scrape failed", details: String(e) },
      { status: 500 }
    );
  }
}
