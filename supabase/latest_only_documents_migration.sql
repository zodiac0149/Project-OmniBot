-- Adds freshness-aware RAG retrieval for volatile documents such as prices,
-- new car inventory, stock, offers, discounts, and sales data.

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

-- Repair earlier price/inventory uploads that were accidentally stored as stable
-- before the upload form used auto-detection.
update public.brand_documents
set "documentType" = 'latest_only',
    "documentCategory" = 'volatile'
where "documentType" = 'stable'
  and "documentCategory" = 'general'
  and (
    coalesce("sourceName", '') ~* '(price|prices|pricing|inventory|stock|availability|new.?cars?|car.?sales|sales.?data|offer|discount)'
    or content ~* '(price list|ex.?showroom|on.?road|inventory|stock|available cars|new cars|variant price|offer price|discount)'
  );

create index if not exists brand_documents_brand_type_updated_idx
  on public.brand_documents ("brandId", "documentType", "sourceUpdatedAt" desc);

create index if not exists brand_documents_brand_type_category_idx
  on public.brand_documents ("brandId", "documentType", "documentCategory");

-- Keep only the newest latest-only batch per brand. This makes existing
-- price/inventory data match the replacement behavior used by the upload API.
delete from public.brand_documents bd
using (
  select "brandId", max("sourceUpdatedAt") as newest_source_updated_at
  from public.brand_documents
  where "documentType" = 'latest_only'
    and "documentCategory" = 'volatile'
  group by "brandId"
) newest
where bd."brandId" = newest."brandId"
  and bd."documentType" = 'latest_only'
  and bd."documentCategory" = 'volatile'
  and bd."sourceUpdatedAt" < newest.newest_source_updated_at;

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
