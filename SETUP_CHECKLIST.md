# Setup checklist – get the app working

Follow these steps in order. After each step you can check **http://localhost:3030/api/status** (once the server is running) to see what’s still missing.

---

## 1. Create `.env.local`

In the project root (`intelligence-outreach-engine/`), create a file named **`.env.local`**.

Copy from `.env.example`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and fill **only the required** variables first.

---

## 2. Required keys (app will not work without these)

| Variable | Where to get it | What to put in `.env.local` |
|----------|------------------|-----------------------------|
| **NEXT_PUBLIC_SUPABASE_URL** | Supabase Dashboard → Project Settings → API → **Project URL** | `https://xxxx.supabase.co` |
| **SUPABASE_SERVICE_ROLE_KEY** | Same page → **service_role** (secret) key | `eyJ...` (long JWT) |
| **ANTHROPIC_API_KEY** | [console.anthropic.com](https://console.anthropic.com) → API Keys | `sk-ant-...` |

Example (use your own values):

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## 3. Create database tables in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor** → **New query**.
3. Open the file **`SUPABASE_SETUP.sql`** in this project.
4. Copy **all** of its contents and paste into the SQL Editor.
5. Click **Run**. You should see “Success” or no errors.

This creates: `entities`, `people`, `pipeline`, `outreach`, `commissions` and indexes.

---

## 4. Run the app (from a path without `!`)

The project path contains `!` (e.g. `Hashed Vibe Haus!`), which can break the build. Use the safe script:

```bash
cd intelligence-outreach-engine
npm run dev:safe
```

This copies the project to `~/outreach-engine`, builds, and starts the server on **http://localhost:3030**.

If you see **“address already in use :::3030”**, stop the old server first:

```bash
lsof -ti:3030 | xargs kill -9
```

Then run `npm run dev:safe` again.

---

## 5. Check status

Open in browser:

- **http://localhost:3030/api/status**

You should see:

- `requiredEnv`: all `true`
- `db.ok`: `true`
- `nextSteps`: suggestion to open the app

If something is `false`, the JSON tells you what to fix (missing env or run SQL).

---

## 6. Use the app

- App: **http://localhost:3030**
- Pipeline: leads from DB
- Research: add companies with “Add new lead” → “Research & add to pipeline”; search filters the list
- Lead Gen: add existing entities to pipeline
- Daily Summary: stats from outreach

---

## 7. Run API tests (optional)

With the server running on 3030:

```bash
cd intelligence-outreach-engine
npm run test:api
```

This calls `/api/status`, `/api/db-test`, `/api/entities`, and optionally `/api/entities/[id]`. You should see JSON (not HTML) for status and db-test.

---

## Optional keys (better data, not required to run)

| Variable | Used for |
|----------|----------|
| FIRECRAWL_API_KEY | Scraping company websites |
| SERPAPI_API_KEY | Google search for research |
| TWITTER_BEARER_TOKEN | Twitter profile + tweets |
| PROXYCURL_API_KEY | LinkedIn/company enrichment |
| GITHUB_TOKEN | GitHub org/repos |
| LUMA_API_KEY | Luma events in Research tab |

See **API_KEYS.md** for where to get each.

---

## Quick reference – what you need to arrange

- **Supabase**: Project URL + service_role key (and run `SUPABASE_SETUP.sql` once).
- **Anthropic**: API key for Claude (research, insights, outreach text).

Once these three are in `.env.local` and the SQL is run, **http://localhost:3030** and **http://localhost:3030/api/status** should both work.
