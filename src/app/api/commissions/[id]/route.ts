import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { amount, currency, status, notes } = body as {
      amount?: number | null;
      currency?: string | null;
      status?: string | null;
      notes?: string | null;
    };

    const updates: Record<string, unknown> = {};
    if (amount !== undefined) updates.amount = amount;
    if (currency !== undefined) updates.currency = currency;
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase
      .from("commissions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: "Update failed", details: String(e) },
      { status: 500 }
    );
  }
}
