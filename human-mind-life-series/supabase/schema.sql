-- Supabase migration scaffold for the Human Mind & Life Series app.
-- This mirrors the SQLite schema used by the app and is intended as the
-- canonical source for the eventual Supabase/Postgres migration.

create extension if not exists pgcrypto;

create table if not exists orders (
  id bigserial primary key,
  ref text not null unique,
  package_type text not null default 'individual',
  product_slug text not null,
  product_title text not null,
  amount integer not null,
  amount_paid real,
  author text,
  buyer_name text not null,
  email text not null,
  whatsapp text not null,
  utr text not null unique,
  screenshot_file text not null,
  screenshot_mime text not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected','delivered')),
  admin_note text,
  utm_json text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz,
  delivered_at timestamptz,
  source_language text not null default 'en',
  target_language text not null default 'en',
  currency text not null default 'INR',
  customer_id bigint,
  payment_status text not null default 'PENDING' check (payment_status in ('PENDING','PAID','FAILED','REFUNDED')),
  payment_provider text not null default 'manual_upi',
  provider_order_id text,
  paid_at timestamptz,
  fulfillment_status text not null default 'NOT_STARTED' check (fulfillment_status in ('NOT_STARTED','PROCESSING','COMPLETED','FAILED')),
  cache_key text,
  translated_book_id bigint,
  access_expires_at timestamptz,
  download_count integer not null default 0,
  ready_email_sent_at timestamptz,
  processing_email_sent_at timestamptz
);

create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created on orders(created_at desc);
create index if not exists idx_orders_provider_order on orders(payment_provider, provider_order_id) where provider_order_id is not null;
create index if not exists idx_orders_cache_key on orders(cache_key);

create table if not exists order_events (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id bigserial primary key,
  name text not null,
  email text not null,
  phone text,
  topic text not null,
  message text not null,
  handled integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists free_requests (
  id bigserial primary key,
  ref text not null unique,
  book_slug text not null,
  book_title text not null,
  author text,
  name text not null,
  email text not null,
  whatsapp text,
  status text not null default 'received' check (status in ('received','sent','completed')),
  admin_note text,
  download_token_hash text unique,
  download_expires_at timestamptz,
  download_count integer not null default 0,
  utm_json text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  completed_at timestamptz
);

create table if not exists customers (
  id bigserial primary key,
  email text not null unique,
  name text not null,
  whatsapp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  provider text not null,
  idempotency_key text not null unique,
  provider_payment_id text,
  provider_order_id text,
  amount real not null,
  currency text not null,
  status text not null,
  raw_event text,
  created_at timestamptz not null default now()
);

create table if not exists translation_jobs (
  id bigserial primary key,
  cache_key text not null unique,
  book_slug text not null,
  source_language text not null,
  target_language text not null,
  source_version text not null,
  strategy text not null,
  status text not null default 'QUEUED' check (status in ('NOT_STARTED','QUEUED','PROCESSING','COMPLETED','FAILED')),
  phase text,
  progress integer not null default 0,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  chars_translated integer not null default 0,
  pages_translated integer not null default 0,
  est_cost_usd real not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists translated_books (
  id bigserial primary key,
  cache_key text not null unique,
  book_slug text not null,
  source_language text not null,
  target_language text not null,
  source_version text not null,
  storage_key text not null,
  bytes integer not null,
  sha256 text not null,
  job_id bigint references translation_jobs(id),
  created_at timestamptz not null default now()
);

create table if not exists order_access_tokens (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null,
  created_at timestamptz not null default now()
);

create table if not exists download_logs (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  item_id bigint,
  event text not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  position integer not null default 0,
  book_slug text not null,
  book_title text not null,
  author text,
  source_language text not null default 'en',
  target_language text not null,
  fulfillment_status text not null default 'NOT_STARTED' check (fulfillment_status in ('NOT_STARTED','PROCESSING','COMPLETED','FAILED')),
  cache_key text,
  translated_book_id bigint,
  download_count integer not null default 0,
  access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, book_slug)
);

create index if not exists idx_items_order on order_items(order_id);
create index if not exists idx_items_cache_key on order_items(cache_key);
