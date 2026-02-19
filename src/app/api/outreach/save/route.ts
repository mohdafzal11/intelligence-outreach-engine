import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { OutreachChannel, OutreachStatus, WrapperType } from "@/lib/types";

const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      entityId,
      personId,
      wrapperType,
      channel,
      subject,
      body: bodyText,
      status,
      sentBy,
      force,
    } = body as {
      entityId: string;
      personId?: string | null;
      wrapperType: WrapperType;
      channel: OutreachChannel;
      subject?: string | null;
      body: string;
      status?: OutreachStatus;
      sentBy?: string | null;
      force?: boolean;
    };
    if (!entityId || !channel || !wrapperType || bodyText == null) {
      return NextResponse.json(
        { error: "entityId, channel, wrapperType, body required" },
        { status: 400 }
      );
    }

    if (!force) {
      const { data: recent } = await supabase
        .from("outreach")
        .select("sent_by, created_at, channel, wrapper_type, status")
        .eq("entity_id", entityId)
        .gt("created_at", THIRTY_DAYS_AGO)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recent) {
        const date = new Date(recent.created_at).toLocaleDateString();
        const warning =
          `Already contacted by ${recent.sent_by ?? "someone"} on ${date} via ${recent.channel} for ${recent.wrapper_type}. Status: ${recent.status}.`;
        return NextResponse.json({ conflict: true, warning }, { status: 200 });
      }
    }

    const { data, error } = await supabase
      .from("outreach")
      .insert({
        entity_id: entityId,
        person_id: personId || null,
        wrapper_type: wrapperType,
        channel,
        subject: subject ?? null,
        body: String(bodyText),
        status: status ?? "draft",
        sent_by: sentBy ?? null,
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: "Save failed", details: String(e) },
      { status: 500 }
    );
  }
}
