/**
 * Seed outreach_templates with 2-3 templates per wrapper type.
 * Run after creating the outreach_templates table (see README).
 * Usage: npx tsx scripts/seed-outreach-templates.ts
 * (Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, e.g. from .env.local)
 */
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  try {
    readFileSync(".env.local", "utf8").split("\n").forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    });
  } catch {
    // ignore
  }
}

const TEMPLATES: { wrapper_type: string; name: string; content: string }[] = [
  { wrapper_type: "sponsor_devrel", name: "DevRel partnership intro", content: "We'd love to explore a devrel partnership: joint workshops, content, and visibility with our developer community. Your stack would resonate well with our audience." },
  { wrapper_type: "sponsor_devrel", name: "Sponsor + thought leadership", content: "Sponsoring our next event would put your team in front of 500+ builders. We can include a keynote or workshop slot to position you as thought leaders." },
  { wrapper_type: "sponsor_devrel", name: "Brand visibility pitch", content: "Partner with us for brand visibility: logo placement, booth, and dedicated session. Our events drive real adoption in the ecosystem." },
  { wrapper_type: "speaker_media", name: "Speaker invite", content: "We're inviting a small group of speakers for [Event]. Your perspective on [topic] would be a great fit for our audience. Would you be open to a 15-min slot?" },
  { wrapper_type: "speaker_media", name: "Media / podcast pitch", content: "We run a podcast and post-event coverage. We'd like to feature your team and product in an interview and recap. Great for reach and credibility." },
  { wrapper_type: "speaker_media", name: "Panel invite", content: "We're putting together a panel on [topic]. We'd love to have you as a panelist. No prep needed beyond a short brief." },
  { wrapper_type: "ecosystem", name: "Integration partnership", content: "We'd like to explore an integration or co-marketing opportunity. Our communities overlap; we can co-host a space or AMA." },
  { wrapper_type: "ecosystem", name: "Ecosystem collaboration", content: "Let's align on ecosystem goals: shared events, co-content, or a joint initiative. We see strong synergy between our roadmaps." },
  { wrapper_type: "ecosystem", name: "Community partnership", content: "Our communities would benefit from a partnership: cross-promotion, shared Discord/Telegram, and joint events." },
  { wrapper_type: "sponsorships", name: "Tiered sponsorship", content: "We offer Gold / Silver / Bronze tiers with clear deliverables: logo, booth, sessions, and post-event report. Happy to send the deck and discuss." },
  { wrapper_type: "sponsorships", name: "Custom package", content: "We can put together a custom package (visibility + sessions + content) that fits your budget and goals. Let's schedule a short call." },
  { wrapper_type: "sponsorships", name: "ROI-focused pitch", content: "Sponsorship includes measurable outcomes: leads, brand lift, and content reuse. We'll share past sponsor results and a proposal." },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local)");
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("outreach_templates")
    .upsert(TEMPLATES, { onConflict: "wrapper_type,name", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("Seed failed. Ensure outreach_templates exists with: unique(wrapper_type, name).", error.message);
    process.exit(1);
  }
  console.log("Seeded", data?.length ?? 0, "outreach templates (duplicates skipped).");
}

main();
