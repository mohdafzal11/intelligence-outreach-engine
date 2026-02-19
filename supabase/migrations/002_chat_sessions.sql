-- Chat sessions for Daily Summary AI conversations
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null,       -- 'user' or 'assistant'
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_chat_messages_session_id on public.chat_messages(session_id);
