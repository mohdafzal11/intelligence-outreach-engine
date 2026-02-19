import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function escapeCsvCell(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const { data: entities, error: entitiesError } = await supabase
    .from("entities")
    .select("id, name, website, category, fit_score")
    .order("created_at", { ascending: false });

  if (entitiesError) {
    return NextResponse.json({ error: entitiesError.message }, { status: 500 });
  }
  if (!entities?.length) {
    const csv = "name,website,category,fit_score,pipeline_stage,last_outreach_date\n";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=entities.csv",
      },
    });
  }

  const entityIds = entities.map((e) => e.id);

  const [
    { data: pipelineRows },
    { data: outreachRows },
  ] = await Promise.all([
    supabase
      .from("pipeline")
      .select("entity_id, stage, updated_at")
      .in("entity_id", entityIds)
      .order("updated_at", { ascending: false }),
    supabase
      .from("outreach")
      .select("entity_id, created_at")
      .in("entity_id", entityIds),
  ]);

  const stageByEntity: Record<string, string> = {};
  for (const row of pipelineRows ?? []) {
    if (!stageByEntity[row.entity_id]) {
      stageByEntity[row.entity_id] = row.stage;
    }
  }

  const lastOutreachByEntity: Record<string, string> = {};
  for (const row of outreachRows ?? []) {
    const current = lastOutreachByEntity[row.entity_id];
    const created = row.created_at;
    if (!current || created > current) {
      lastOutreachByEntity[row.entity_id] = created;
    }
  }

  const header = "name,website,category,fit_score,pipeline_stage,last_outreach_date";
  const rows = (entities as { id: string; name: string; website: string | null; category: string[]; fit_score: number | null }[]).map(
    (e) => {
      const category = Array.isArray(e.category) ? e.category.join("; ") : "";
      const stage = stageByEntity[e.id] ?? "";
      const lastDate = lastOutreachByEntity[e.id]
        ? new Date(lastOutreachByEntity[e.id]).toISOString().slice(0, 10)
        : "";
      return [
        escapeCsvCell(e.name),
        escapeCsvCell(e.website),
        escapeCsvCell(category),
        e.fit_score != null ? String(e.fit_score) : "",
        escapeCsvCell(stage),
        escapeCsvCell(lastDate),
      ].join(",");
    }
  );
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=entities.csv",
    },
  });
}
