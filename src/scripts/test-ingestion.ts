/**
 * Test ingestion + AI insights.
 * Run: npx tsx src/scripts/test-ingestion.ts
 *   or: npm run test:ingestion
 * Loads .env.local from project root. Requires ANTHROPIC_API_KEY; optional: FIRECRAWL_API_KEY, SERPAPI_API_KEY, TWITTER_BEARER_TOKEN
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local from project root (where package.json lives)
const root = resolve(process.cwd());
for (const f of [".env.local", ".env"]) {
  const p = resolve(root, f);
  if (existsSync(p)) {
    const content = readFileSync(p, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
    break;
  }
}

import { researchCompany } from "../lib/ingestion/orchestrator";
import { generateInsights } from "../lib/ai/ai";

const INPUT = {
  name: "Polygon Labs",
  website: "https://polygon.technology",
  twitterHandle: "0xPolygon",
};

function section(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function printWebsite(result: Awaited<ReturnType<typeof researchCompany>>["website"]) {
  if (result === null) {
    console.log("(no data — scrape failed or no URL provided)");
    return;
  }
  console.log("Title:", result.title || "(none)");
  console.log("Content length:", result.content.length, "chars");
  console.log("Content preview (first 400 chars):");
  console.log(result.content.slice(0, 400).replace(/\n/g, " ") + (result.content.length > 400 ? "…" : ""));
}

function printGoogle(results: Awaited<ReturnType<typeof researchCompany>>["google"]) {
  if (!results?.length) {
    console.log("(no results)");
    return;
  }
  console.log(`Total results: ${results.length}`);
  results.slice(0, 5).forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.title}`);
    console.log(`     ${r.link}`);
    console.log(`     ${(r.snippet || "").slice(0, 120)}…`);
  });
  if (results.length > 5) console.log(`  ... and ${results.length - 5} more`);
}

function printTwitter(result: Awaited<ReturnType<typeof researchCompany>>["twitter"]) {
  if (result === null) {
    console.log("(no data — API failed or no handle provided)");
    return;
  }
  const { profile, tweets } = result;
  console.log("Profile:", profile.name ?? profile.username ?? "(unknown)");
  console.log("Description:", (profile.description || "").slice(0, 200) + (profile.description && profile.description.length > 200 ? "…" : ""));
  if (profile.public_metrics) {
    console.log("Metrics:", JSON.stringify(profile.public_metrics));
  }
  console.log("Tweets (last", tweets.length, "):");
  tweets.slice(0, 3).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.text.slice(0, 100)}${t.text.length > 100 ? "…" : ""}`);
  });
  if (tweets.length > 3) console.log(`  ... and ${tweets.length - 3} more`);
}

async function main() {
  console.log("Intelligence & Outreach Engine — Ingestion test");
  console.log("Input:", JSON.stringify(INPUT, null, 2));

  // 1. Research (all sources in parallel; failures logged in each module and collected in errors)
  section("1. researchCompany() — source results");
  let research;
  try {
    research = await researchCompany(INPUT);
  } catch (err) {
    console.error("researchCompany() threw:");
    console.error(err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  }

  console.log("\n--- Website ---");
  printWebsite(research.website);
  console.log("\n--- Google ---");
  printGoogle(research.google);
  console.log("\n--- Twitter ---");
  printTwitter(research.twitter);

  if (research.errors.length > 0) {
    section("Ingestion errors (sources that failed)");
    research.errors.forEach((e) => console.log(" •", e));
  }

  // 2. Raw data for AI
  const rawData = {
    website: research.website,
    google: research.google,
    twitter: research.twitter,
  };

  // 3. AI insights
  section("2. generateInsights() — AI output");
  let insights;
  try {
    insights = await generateInsights(INPUT.name, rawData);
  } catch (err) {
    console.error("generateInsights() failed:");
    console.error(err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  }

  console.log("\nOverview:");
  console.log(insights.overview);
  console.log("\nCategory:", insights.category?.join(", ") ?? "(none)");
  console.log("Fit score:", insights.fit_score);
  console.log("Fit breakdown:", JSON.stringify(insights.fit_breakdown, null, 2));
  console.log("\nSuggested contacts:");
  (insights.suggested_contacts ?? []).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} — ${c.likely_role}`);
    console.log(`     ${c.reasoning?.slice(0, 120)}…`);
  });
  console.log("\nKey hooks:");
  (insights.key_hooks ?? []).forEach((h, i) => console.log(`  ${i + 1}. ${h}`));

  section("Done");
  console.log("All steps completed successfully.");
}

main();
