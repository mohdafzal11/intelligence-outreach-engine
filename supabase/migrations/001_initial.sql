-- Run this in Supabase Dashboard → SQL Editor if Research fails with "tables missing"

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

create index if not exists idx_people_entity_id on public.people(entity_id);
create index if not exists idx_pipeline_entity_id on public.pipeline(entity_id);
create index if not exists idx_outreach_entity_id on public.outreach(entity_id);
