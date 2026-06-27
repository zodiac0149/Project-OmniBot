-- Legacy organization schema. For the brand portal model, use brand_portal_schema.sql instead.
create extension if not exists vector;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  disabled boolean not null default false,
  "createdAt" timestamptz not null default now()
);

create unique index if not exists organizations_name_key
  on public.organizations (lower(name));

alter table public.organizations enable row level security;

drop policy if exists "Users can read their organization" on public.organizations;

create policy "Users can read their organization"
  on public.organizations
  for select
  using (
    disabled = false
    or auth.jwt() -> 'user_metadata' ->> 'orgId' = id::text
  );

create table if not exists public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  "organizationId" uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'customer' check (role in ('customer', 'manager', 'admin')),
  "passwordHash" text not null,
  disabled boolean not null default false,
  "lastAccessAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  unique ("organizationId", email)
);

create index if not exists customer_accounts_org_email_idx
  on public.customer_accounts ("organizationId", email);

alter table public.customer_accounts enable row level security;

create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  "orgId" uuid not null references public.organizations(id) on delete cascade,
  content text not null,
  embedding vector(1024) not null,
  "sourceName" text,
  "createdAt" timestamptz not null default now()
);

create index if not exists knowledge_base_embedding_idx
  on public.knowledge_base
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.knowledge_base enable row level security;

drop policy if exists "Users can read their organization knowledge" on public.knowledge_base;

create policy "Users can read their organization knowledge"
  on public.knowledge_base
  for select
  using (auth.jwt() -> 'user_metadata' ->> 'orgId' = "orgId"::text);

create or replace function public.match_knowledge(
  query_embedding vector(1024),
  match_org_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  "sourceName" text,
  similarity float
)
language sql
stable
as $$
  select
    knowledge_base.id,
    knowledge_base.content,
    knowledge_base."sourceName",
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  from public.knowledge_base
  where knowledge_base."orgId" = match_org_id
  order by knowledge_base.embedding <=> query_embedding
  limit match_count;
$$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  "orgId" uuid not null references public.organizations(id) on delete cascade,
  "customerEmail" text,
  status text not null default 'Open' check (status in ('Open', 'Resolved', 'Escalated')),
  "sentimentScore" double precision not null default 0,
  "createdAt" timestamptz not null default now()
);

create index if not exists conversations_org_status_idx
  on public.conversations ("orgId", status);

alter table public.conversations enable row level security;

drop policy if exists "Users can read their organization conversations" on public.conversations;

create policy "Users can read their organization conversations"
  on public.conversations
  for select
  using (auth.jwt() -> 'user_metadata' ->> 'orgId' = "orgId"::text);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  "conversationId" uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages ("conversationId", "createdAt");

alter table public.messages enable row level security;

drop policy if exists "Users can read their organization messages" on public.messages;

create policy "Users can read their organization messages"
  on public.messages
  for select
  using (
    exists (
      select 1
      from public.conversations
      where conversations.id = messages."conversationId"
        and auth.jwt() -> 'user_metadata' ->> 'orgId' = conversations."orgId"::text
    )
  );
