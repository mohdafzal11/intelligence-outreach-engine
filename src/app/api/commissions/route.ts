import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get("entity_id");
  const wrapperType = searchParams.get("wrapper_type");

  let query = supabase
    .from("commissions")
    .select("*, entities(id, name)")
    .order("created_at", { ascending: false });
  if (entityId) query = query.eq("entity_id", entityId);
  if (wrapperType) query = query.eq("wrapper_type", wrapperType);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entityId, wrapperType, amount, currency, status, notes } = body as {
      entityId: string;
      wrapperType: string;
      amount?: number | null;
      currency?: string | null;
      status?: string | null;
      notes?: string | null;
    };
    if (!entityId || !wrapperType) {
      return NextResponse.json(
        { error: "entityId and wrapperType required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("commissions")
      .insert({
        entity_id: entityId,
        wrapper_type: wrapperType,
        amount: amount ?? null,
        currency: currency ?? "USD",
        status: status ?? "pending",
        notes: notes ?? null,
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: "Create commission failed", details: String(e) },
      { status: 500 }
    );
  }
}
