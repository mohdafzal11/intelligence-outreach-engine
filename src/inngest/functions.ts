import { inngest } from "./client";

/**
 * Weekly digest: runs every Monday 9am. Fetches pipeline + outreach stats for reporting.
 * Extend later to email Niha/Ekta/Chiranjeev/Shaun or write to a digest table.
 */
export const weeklyDigest = inngest.createFunction(
  {
    id: "weekly-digest",
    name: "Weekly pipeline digest",
  },
  { cron: "0 9 * * 1" }, // Monday 9:00
  async ({ step }) => {
    const { supabase } = await import("@/lib/supabase");
    const [{ count: entityCount }, { count: pipelineCount }, { count: outreachCount }] = await Promise.all([
      supabase.from("entities").select("id", { count: "exact", head: true }),
      supabase.from("pipeline").select("id", { count: "exact", head: true }),
      supabase.from("outreach").select("id", { count: "exact", head: true }),
    ]);
    await step.run("log-digest", () => {
      console.log("[weekly-digest]", {
        entities: entityCount ?? 0,
        pipeline: pipelineCount ?? 0,
        outreach: outreachCount ?? 0,
      });
      return { entities: entityCount ?? 0, pipeline: pipelineCount ?? 0, outreach: outreachCount ?? 0 };
    });
    return { ok: true };
  }
);

/**
 * Follow-up reminder: can be triggered manually or by cron to find outreach needing follow-up.
 */
export const followUpReminder = inngest.createFunction(
  {
    id: "follow-up-reminder",
    name: "Follow-up needed reminder",
  },
  { event: "outreach/follow-up.reminder" },
  async ({ step }) => {
    const { supabase } = await import("@/lib/supabase");
    const { data: list } = await supabase
      .from("outreach")
      .select("id, entity_id, created_at")
      .eq("status", "follow_up_needed")
      .limit(50);
    await step.run("log-reminders", () => {
      console.log("[follow-up-reminder]", (list ?? []).length, "outreach need follow-up");
      return { count: (list ?? []).length };
    });
    return { ok: true };
  }
);
