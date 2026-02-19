# Intelligence & Outreach Engine

Internal MVP tool for HEM (web3 events): research companies, manage pipeline, and track outreach.

## Stack

- **Next.js 14** (App Router, TypeScript, Tailwind)
- **shadcn-style UI** (minimal components in `src/components/ui`)
- **Supabase** (DB client; tables created manually)
- **TanStack Query** (data fetching)
- **Anthropic Claude** (insights + outreach drafts)

## Run localhost (recommended)

If your project lives in a path that contains **`!`** (e.g. `Hashed Vibe Haus!`), the dev server will fail. Use the safe script instead — it copies the project to `~/outreach-engine`, builds, and starts the server:

```bash
npm run dev:safe
```

Then open **http://localhost:3000** in your browser. The app (Research, Pipeline, Outreach tabs) will load. Create the Supabase tables (see below) so the API works.

## Setup

1. **Clone / open** the project in a path **without** `!` in the folder name (Webpack reserves `!`). If your path has spaces or `!`, use `npm run dev:safe` above.

2. **Install and run** (only if your path has no `!`)
   ```bash
   npm install
   npm run dev
   ```

3. **Environment**
   - Copy `.env.example` to `.env.local`
   - Set at least:
     - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (required for DB)
     - `ANTHROPIC_API_KEY` (required for research + draft)
   - Optional for ingestion: `FIRECRAWL_API_KEY`, `SERPAPI_API_KEY`, `TWITTER_BEARER_TOKEN`

4. **Supabase tables**  
   Create these in the Supabase SQL editor (or Table Editor) so types match `src/lib/types.ts`:

```sql
-- entities
create table entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  twitter_handle text,
  category text[] default '{}',
  description text,
  overview text,
  fit_score int check (fit_score >= 0 and fit_score <= 100),
  fit_score_breakdown jsonb,
  raw_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- people
create table people (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  name text not null,
  role text,
  email text,
  twitter_handle text,
  linkedin_url text,
  created_at timestamptz default now()
);

-- outreach
create table outreach (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  person_id uuid references people(id) on delete set null,
  wrapper_type text not null check (wrapper_type in ('sponsor_devrel','speaker_media','sponsorships','ecosystem')),
  channel text not null check (channel in ('email','linkedin_dm','telegram')),
  subject text,
  body text not null,
  status text not null default 'draft' check (status in ('draft','sent','replied','follow_up_needed','closed')),
  sent_by text,
  created_at timestamptz default now()
);

-- pipeline
create table pipeline (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  wrapper_type text not null check (wrapper_type in ('sponsor_devrel','speaker_media','sponsorships','ecosystem')),
  stage text not null default 'lead' check (stage in ('lead','contacted','in_discussion','proposal_sent','confirmed','lost')),
  owner text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- optional: updated_at trigger for entities + pipeline
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
create trigger entities_updated_at before update on entities
  for each row execute function set_updated_at();
create trigger pipeline_updated_at before update on pipeline
  for each row execute function set_updated_at();

-- commissions (optional: for Sponsorships wrapper - Shaun)
create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  wrapper_type text not null check (wrapper_type in ('sponsor_devrel','speaker_media','sponsorships','ecosystem')),
  amount decimal(12,2),
  currency text default 'USD',
  status text default 'pending' check (status in ('pending','confirmed','paid')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger commissions_updated_at before update on commissions
  for each row execute function set_updated_at();

-- outreach_templates (optional: seed for AI to reference when drafting)
create table if not exists outreach_templates (
  id uuid primary key default gen_random_uuid(),
  wrapper_type text not null check (wrapper_type in ('sponsor_devrel','speaker_media','sponsorships','ecosystem')),
  name text not null,
  content text not null,
  created_at timestamptz default now(),
  unique(wrapper_type, name)
);

-- Seed 2-3 templates per wrapper type (run after creating the table)
insert into outreach_templates (wrapper_type, name, content) values
('sponsor_devrel', 'DevRel partnership intro', 'We’d love to explore a devrel partnership: joint workshops, content, and visibility with our developer community. Your stack would resonate well with our audience.'),
('sponsor_devrel', 'Sponsor + thought leadership', 'Sponsoring our next event would put your team in front of 500+ builders. We can include a keynote or workshop slot to position you as thought leaders.'),
('sponsor_devrel', 'Brand visibility pitch', 'Partner with us for brand visibility: logo placement, booth, and dedicated session. Our events drive real adoption in the ecosystem.'),
('speaker_media', 'Speaker invite', 'We’re inviting a small group of speakers for [Event]. Your perspective on [topic] would be a great fit for our audience. Would you be open to a 15-min slot?'),
('speaker_media', 'Media / podcast pitch', 'We run a podcast and post-event coverage. We’d like to feature your team and product in an interview and recap. Great for reach and credibility.'),
('speaker_media', 'Panel invite', 'We’re putting together a panel on [topic]. We’d love to have you as a panelist. No prep needed beyond a short brief.'),
('ecosystem', 'Integration partnership', 'We’d like to explore an integration or co-marketing opportunity. Our communities overlap; we can co-host a space or AMA.'),
('ecosystem', 'Ecosystem collaboration', 'Let’s align on ecosystem goals: shared events, co-content, or a joint initiative. We see strong synergy between our roadmaps.'),
('ecosystem', 'Community partnership', 'Our communities would benefit from a partnership: cross-promotion, shared Discord/Telegram, and joint events.'),
('sponsorships', 'Tiered sponsorship', 'We offer Gold / Silver / Bronze tiers with clear deliverables: logo, booth, sessions, and post-event report. Happy to send the deck and discuss.'),
('sponsorships', 'Custom package', 'We can put together a custom package (visibility + sessions + content) that fits your budget and goals. Let’s schedule a short call.'),
('sponsorships', 'ROI-focused pitch', 'Sponsorship includes measurable outcomes: leads, brand lift, and content reuse. We’ll share past sponsor results and a proposal.')
on conflict (wrapper_type, name) do nothing;
```

## Usage

- **Research**: Enter company name, optional website + Twitter → runs ingestion (Firecrawl/Jina, SerpAPI, Twitter) and AI insights → saves entity + suggested people. You can “Add to pipeline” and “Draft outreach”.
- **Pipeline**: Table of pipeline rows with entity, wrapper, stage (dropdown), fit score, owner. Filter by wrapper/stage; click row to expand outreach history.
- **Outreach**: Table of all outreach with company, person, channel, status (dropdown), sent by, date. Filter by wrapper/status.

No auth in this MVP.

## Testing the API

If you see `Could not find the table 'public.entities' in the schema cache`, the tables are missing or Supabase is using another project/schema. Create the tables in the **same** project as `NEXT_PUBLIC_SUPABASE_URL` (SQL above) and retry after a few seconds.

Run the app (e.g. `npm run dev:safe`), then:

```bash
# 1. Test DB connection (insert → read → delete one entity)
curl http://localhost:3000/api/db-test

# 2. List entities (sorted by created_at desc)
curl http://localhost:3000/api/entities

# 3. Get one entity with people, outreach, pipeline (replace ID with a real uuid)
curl http://localhost:3000/api/entities/YOUR_ENTITY_ID

# 4. Research (creates entity + people + pipeline if new; returns existing with existing: true if name/website match)
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Inc","website":"https://acme.example.com"}'

# 5. Export entities CSV (for reporting)
curl -o entities.csv http://localhost:3000/api/entities/export
```

### Testing the full flow

Run the app from a path **without** `!` (e.g. `npm run dev:safe`). Then test:

1. **Well-known web3**: Research "Alchemy", https://alchemy.com, @AlchemyPlatform — expect good data and a solid fit score.
2. **Smaller startup**: Research a smaller name with less data — ingestion may fall back to Jina; fit score may be lower.
3. **Non-web3**: Research a non-web3 company — fit score should reflect low relevance (e.g. red / 0–39).
4. **Dedup**: Research the same company again — UI shows "Company already in database" and returns the existing entity.
5. **Conflict**: Save outreach for an entity, then try saving again within 30 days — yellow banner and "Proceed anyway?".
6. **Export**: Click "Export entities (CSV)" on the Research tab — downloads `entities.csv` with name, website, category, fit_score, pipeline_stage, last_outreach_date.
