import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { weeklyDigest, followUpReminder } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [weeklyDigest, followUpReminder],
});
