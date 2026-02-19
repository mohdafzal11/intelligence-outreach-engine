-- Run this if you already ran SUPABASE_SETUP.sql before and need only the Luma events table.
-- Or use the full SUPABASE_SETUP.sql which now includes this table.

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
