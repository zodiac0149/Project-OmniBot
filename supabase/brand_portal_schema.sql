-- =========================================================
-- BRAND PORTAL SCHEMA
-- Admin console (manage brands, policies, RAG docs)
-- Customer login (Gmail + brand + password, multi-brand, last-used brand)
-- =========================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 1. ADMINS
-- Separate login path from customers. Manages brands, policies, docs.
-- ---------------------------------------------------------
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  "passwordHash" text not null,
  disabled boolean not null default false,
  "lastLoginAt" timestamptz,
  "createdAt" timestamptz not null default now()
);

alter table public.admins enable row level security;
-- No client-side select/insert/update policies on purpose.
-- Admin auth should be verified server-side (service role), never via anon/authenticated client roles.

-- Default admin: username `admin`, password `password123`
-- Hash = sha256("admin:password123")
insert into public.admins (username, "passwordHash")
values ('admin', 'c8b0d8a4a585323c7e2c9d7624779327548d6a033a9ee9e427d3faad84e40df6')
on conflict (username) do nothing;


-- ---------------------------------------------------------
-- 2. BRANDS
-- Created by admin. Holds brand policy + detailed instructions.
-- ---------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  policy text,
  instructions text,
  disabled boolean not null default false,
  "createdBy" uuid references public.admins(id) on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists brands_name_key
  on public.brands (lower(name));

alter table public.brands enable row level security;

drop policy if exists "Anyone authenticated can read active brands" on public.brands;
create policy "Anyone authenticated can read active brands"
  on public.brands
  for select
  using (disabled = false);


-- ---------------------------------------------------------
-- 3. CUSTOMERS
-- One row per Gmail. One shared password across all linked brands.
-- lastBrandId = brand to pre-select at next login.
-- ---------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  "passwordHash" text not null,
  "lastBrandId" uuid references public.brands(id) on delete set null,
  disabled boolean not null default false,
  "lastAccessAt" timestamptz,
  "createdAt" timestamptz not null default now()
);

alter table public.customers enable row level security;

drop policy if exists "Customers can read their own record" on public.customers;
create policy "Customers can read their own record"
  on public.customers
  for select
  using (auth.jwt() ->> 'email' = email);

drop policy if exists "Customers can update their own lastBrandId" on public.customers;
create policy "Customers can update their own lastBrandId"
  on public.customers
  for update
  using (auth.jwt() ->> 'email' = email)
  with check (auth.jwt() ->> 'email' = email);


-- ---------------------------------------------------------
-- 4. CUSTOMER_BRAND_LINKS (join table)
-- ---------------------------------------------------------
create table if not exists public.customer_brand_links (
  id uuid primary key default gen_random_uuid(),
  "customerId" uuid not null references public.customers(id) on delete cascade,
  "brandId" uuid not null references public.brands(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  unique ("customerId", "brandId")
);

create index if not exists customer_brand_links_customer_idx
  on public.customer_brand_links ("customerId");

create index if not exists customer_brand_links_brand_idx
  on public.customer_brand_links ("brandId");

alter table public.customer_brand_links enable row level security;

drop policy if exists "Customers can read their own brand links" on public.customer_brand_links;
create policy "Customers can read their own brand links"
  on public.customer_brand_links
  for select
  using (
    exists (
      select 1 from public.customers
      where customers.id = customer_brand_links."customerId"
        and customers.email = auth.jwt() ->> 'email'
    )
  );


-- ---------------------------------------------------------
-- 5. BRAND_DOCUMENTS (RAG store, one per brand)
-- ---------------------------------------------------------
create table if not exists public.brand_documents (
  id uuid primary key default gen_random_uuid(),
  "brandId" uuid not null references public.brands(id) on delete cascade,
  content text not null,
  embedding vector(1024) not null,
  "sourceName" text,
  "chunkIndex" int,
  "documentType" text not null default 'stable' check ("documentType" in ('stable', 'latest_only')),
  "documentCategory" text not null default 'general' check ("documentCategory" in ('general', 'policy_terms_warranty', 'volatile')),
  "uploadBatchId" uuid not null default gen_random_uuid(),
  "sourceUpdatedAt" timestamptz not null default now(),
  "createdAt" timestamptz not null default now()
);

alter table public.brand_documents
  add column if not exists "documentType" text not null default 'stable';

alter table public.brand_documents
  add column if not exists "documentCategory" text not null default 'general';

alter table public.brand_documents
  add column if not exists "uploadBatchId" uuid not null default gen_random_uuid();

alter table public.brand_documents
  add column if not exists "sourceUpdatedAt" timestamptz not null default now();

alter table public.brand_documents
  drop constraint if exists brand_documents_document_type_check;

alter table public.brand_documents
  add constraint brand_documents_document_type_check
  check ("documentType" in ('stable', 'latest_only'));

alter table public.brand_documents
  drop constraint if exists brand_documents_document_category_check;

alter table public.brand_documents
  add constraint brand_documents_document_category_check
  check ("documentCategory" in ('general', 'policy_terms_warranty', 'volatile'));

update public.brand_documents
set "documentCategory" = 'volatile'
where "documentType" = 'latest_only'
  and "documentCategory" <> 'volatile';

update public.brand_documents
set "documentCategory" = 'policy_terms_warranty'
where "documentType" = 'stable'
  and "documentCategory" = 'general'
  and (
    coalesce("sourceName", '') ~* '(policy|policies|terms|warranty|warranties)'
    or content ~* '(policy|policies|terms|warranty|warranties)'
  );

create index if not exists brand_documents_embedding_idx
  on public.brand_documents
  using hnsw (embedding vector_cosine_ops);

create index if not exists brand_documents_brand_idx
  on public.brand_documents ("brandId");

create index if not exists brand_documents_brand_type_updated_idx
  on public.brand_documents ("brandId", "documentType", "sourceUpdatedAt" desc);

create index if not exists brand_documents_brand_type_category_idx
  on public.brand_documents ("brandId", "documentType", "documentCategory");

alter table public.brand_documents enable row level security;

drop policy if exists "Customers can read docs for brands they belong to" on public.brand_documents;
create policy "Customers can read docs for brands they belong to"
  on public.brand_documents
  for select
  using (
    exists (
      select 1
      from public.customer_brand_links cbl
      join public.customers c on c.id = cbl."customerId"
      where cbl."brandId" = brand_documents."brandId"
        and c.email = auth.jwt() ->> 'email'
    )
  );


-- ---------------------------------------------------------
-- 6. CONVERSATIONS + MESSAGES (chat history per brand)
-- ---------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  "brandId" uuid not null references public.brands(id) on delete cascade,
  "customerEmail" text,
  status text not null default 'Open' check (status in ('Open', 'Resolved', 'Escalated')),
  "sentimentScore" double precision not null default 0,
  "createdAt" timestamptz not null default now()
);

create index if not exists conversations_brand_status_idx
  on public.conversations ("brandId", status);

alter table public.conversations enable row level security;

drop policy if exists "Customers can read their brand conversations" on public.conversations;
create policy "Customers can read their brand conversations"
  on public.conversations
  for select
  using (
    exists (
      select 1
      from public.customer_brand_links cbl
      join public.customers c on c.id = cbl."customerId"
      where cbl."brandId" = conversations."brandId"
        and c.email = auth.jwt() ->> 'email'
    )
  );

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

drop policy if exists "Customers can read their brand messages" on public.messages;
create policy "Customers can read their brand messages"
  on public.messages
  for select
  using (
    exists (
      select 1
      from public.conversations
      join public.customer_brand_links cbl on cbl."brandId" = conversations."brandId"
      join public.customers c on c.id = cbl."customerId"
      where conversations.id = messages."conversationId"
        and c.email = auth.jwt() ->> 'email'
    )
  );


-- ---------------------------------------------------------
-- 7. match_brand_documents()
-- ---------------------------------------------------------
create or replace function public.match_brand_documents(
  query_embedding vector(1024),
  match_brand_id uuid,
  match_count int default 5,
  match_document_type text default 'stable'
)
returns table (
  id uuid,
  content text,
  "sourceName" text,
  "documentType" text,
  "documentCategory" text,
  "sourceUpdatedAt" timestamptz,
  similarity float
)
language sql
stable
as $$
  with latest_batch as (
    select bd."uploadBatchId"
    from public.brand_documents bd
    where bd."brandId" = match_brand_id
      and bd."documentType" = 'latest_only'
    order by bd."sourceUpdatedAt" desc, bd."createdAt" desc
    limit 1
  )
  select
    brand_documents.id,
    brand_documents.content,
    brand_documents."sourceName",
    brand_documents."documentType",
    brand_documents."documentCategory",
    brand_documents."sourceUpdatedAt",
    1 - (brand_documents.embedding <=> query_embedding) as similarity
  from public.brand_documents
  where brand_documents."brandId" = match_brand_id
    and brand_documents."documentType" = match_document_type
    and (
      match_document_type <> 'latest_only'
      or brand_documents."uploadBatchId" = (select latest_batch."uploadBatchId" from latest_batch)
    )
  order by brand_documents.embedding <=> query_embedding
  limit match_count;
$$;


-- ---------------------------------------------------------
-- 8. Trigger: keep brands.updatedAt fresh
-- ---------------------------------------------------------
create or replace function public.set_brands_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists trg_brands_updated_at on public.brands;
create trigger trg_brands_updated_at
  before update on public.brands
  for each row
  execute function public.set_brands_updated_at();
