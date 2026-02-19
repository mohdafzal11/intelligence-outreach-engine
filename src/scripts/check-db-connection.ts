/**
 * Quick check that Supabase is reachable and the app can talk to the DB.
 * Run: npx tsx src/scripts/check-db-connection.ts
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log("Checking Supabase connection...\n");

  if (!url) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL is not set in .env.local");
    process.exit(1);
  }
  console.log("✓ NEXT_PUBLIC_SUPABASE_URL:", url);

  if (!key) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not set in .env.local");
    process.exit(1);
  }
  console.log("✓ SUPABASE_SERVICE_ROLE_KEY: set (hidden)");

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Try to query a table (entities is the main one; may not exist yet)
  const { data, error } = await supabase.from("entities").select("id").limit(1);

  if (error) {
    if (error.code === "PGRST116" || error.message?.includes("relation") || error.message?.includes("does not exist")) {
      console.log("\n✓ Connection to Supabase succeeded.");
      console.log("  Tables are not created yet (or 'entities' is missing). Run the SQL from README in Supabase SQL Editor to create them.");
    } else {
      console.error("\n❌ Database error:", error.message);
      console.error("   Code:", error.code);
      process.exit(1);
    }
  } else {
    console.log("\n✓ Connection successful. Supabase is connected.");
    console.log("  entities table exists. Row count (sample):", Array.isArray(data) ? data.length : 0);
  }
}

main().catch((err) => {
  console.error("\n❌ Connection failed:", err.message);
  process.exit(1);
});
