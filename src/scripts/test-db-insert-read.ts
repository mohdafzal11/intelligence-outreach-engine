/**
 * Test Supabase client: insert one entity, read it back, then delete it.
 * Run: npx tsx src/scripts/test-db-insert-read.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const testName = "DB Test Entity " + Date.now();
  const testWebsite = "https://test.example.com";

  console.log("1. Inserting entity...");
  const { data: inserted, error: insertError } = await supabase
    .from("entities")
    .insert({
      name: testName,
      website: testWebsite,
      twitter_handle: null,
      category: ["Test"],
      description: null,
      overview: "Test overview",
      fit_score: 50,
      fit_score_breakdown: null,
      raw_data: null,
    })
    .select("id, name, website, created_at")
    .single();

  if (insertError) {
    console.error("Insert failed:", insertError.message);
    process.exit(1);
  }
  console.log("   Inserted:", inserted);

  console.log("2. Reading entity back...");
  const { data: read, error: readError } = await supabase
    .from("entities")
    .select("*")
    .eq("id", inserted.id)
    .single();

  if (readError) {
    console.error("Read failed:", readError.message);
    await supabase.from("entities").delete().eq("id", inserted.id);
    process.exit(1);
  }
  console.log("   Read:", { id: read.id, name: read.name, website: read.website });

  console.log("3. Deleting test entity...");
  const { error: deleteError } = await supabase.from("entities").delete().eq("id", inserted.id);
  if (deleteError) {
    console.error("Delete failed:", deleteError.message);
    process.exit(1);
  }
  console.log("   Deleted.");

  console.log("\n✓ Supabase client works: insert, read, and delete succeeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
