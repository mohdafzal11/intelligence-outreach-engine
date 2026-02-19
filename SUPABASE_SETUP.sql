-- ============================================================
-- COPY ALL OF THIS AND RUN IN SUPABASE SQL EDITOR (ONE TIME)
-- Dashboard: https://supabase.com/dashboard → Your project → SQL Editor → New query
-- ============================================================

-- 1. Entities (companies you research)
create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  twitter_handle text,
  category text[] default '{}',
  description text,
  overview text,
  fit_score smallint,
  fit_score_breakdown jsonb,
  raw_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. People (contacts per entity)
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  name text not null,
  role text,
  email text,
  twitter_handle text,
  linkedin_url text,
  created_at timestamptz default now()
);

-- 3. Pipeline (leads / deal stages)
create table if not exists public.pipeline (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  wrapper_type text not null,
  stage text not null,
  owner text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Outreach (emails / DMs sent)
create table if not exists public.outreach (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  wrapper_type text not null,
  channel text not null,
  subject text,
  body text not null,
  status text not null,
  sent_by text,
  created_at timestamptz default now()
);

-- 5. Commissions (optional – for tracking)
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  wrapper_type text not null,
  amount numeric,
  currency text default 'USD',
  status text default 'pending',
  notes text,
  created_at timestamptz default now()
);

-- 6. Luma events (scraped per company – show when searching company name)
create table if not exists public.luma_events (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  entity_id uuid references public.entities(id) on delete set null,
  title text not null,
  url text not null,
  event_date date,
  start_at timestamptz,
  description text,
  snippet text,
  source_url text not null,
  created_at timestamptz default now()
);
create index if not exists idx_luma_events_company on public.luma_events(lower(company_name));
create index if not exists idx_luma_events_entity_id on public.luma_events(entity_id);

-- Indexes
create index if not exists idx_people_entity_id on public.people(entity_id);
create index if not exists idx_pipeline_entity_id on public.pipeline(entity_id);
create index if not exists idx_outreach_entity_id on public.outreach(entity_id);
create index if not exists idx_commissions_entity_id on public.commissions(entity_id);
