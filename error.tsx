begin;

create extension if not exists pgcrypto with schema extensions;

create sequence if not exists public.order_reference_seq start with 1001;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  member_number char(7) unique,
  full_name text,
  phone text unique,
  email text,
  avatar_path text,
  preferred_branch_id uuid,
  locale text not null default 'ar-SA',
  status text not null default 'active' check (status in ('active','suspended','deleted')),
  last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  is_system boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  domain text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_id, permission_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  branch_id uuid,
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique nulls not distinct (user_id, role_id, branch_id)
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text,
  slug text not null unique,
  address text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone text,
  opening_hours jsonb not null default '{}'::jsonb,
  accepting_orders boolean not null default true,
  expected_prep_minutes integer not null default 15 check (expected_prep_minutes between 1 and 240),
  payment_methods text[] not null default array['cash']::text[],
  parking_notes text,
  status text not null default 'active' check (status in ('active','paused','closed')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

alter table public.profiles
  add constraint profiles_preferred_branch_fk
  foreign key (preferred_branch_id) references public.branches(id) on delete set null;

alter table public.user_roles
  add constraint user_roles_branch_fk
  foreign key (branch_id) references public.branches(id) on delete cascade;

create table public.branch_staff (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  employee_code text,
  job_title text,
  is_active boolean not null default true,
  started_at date,
  ended_at date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (branch_id, user_id)
);

create table public.branch_settings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null unique references public.branches(id) on delete cascade,
  tax_rate numeric(6,4) not null default 0.15 check (tax_rate between 0 and 1),
  service_fee numeric(12,2) not null default 0 check (service_fee >= 0),
  cash_enabled boolean not null default true,
  online_payment_enabled boolean not null default false,
  loyalty_program_id uuid,
  loyalty_mode text not null default 'global' check (loyalty_mode in ('global','branch')),
  order_settings jsonb not null default '{}'::jsonb,
  parking_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.parking_spots (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  code text not null,
  name_ar text not null,
  location_hint text,
  qr_token_hash text unique,
  status text not null default 'available' check (status in ('available','occupied','disabled')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique (branch_id, code)
);

create table public.customer_vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_type text not null,
  make text not null,
  model text,
  color text not null,
  plate_hint text,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create unique index customer_one_default_vehicle_idx
  on public.customer_vehicles(customer_id) where is_default and deleted_at is null;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name_ar text not null,
  name_en text,
  slug text not null unique,
  image_path text,
  display_order integer not null default 0,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  name_ar text not null,
  name_en text,
  slug text not null unique,
  description_ar text,
  description_en text,
  image_path text,
  base_price numeric(12,2) not null check (base_price >= 0),
  sku text unique,
  prep_minutes integer not null default 5 check (prep_minutes between 0 and 240),
  calories integer check (calories >= 0),
  allergens text[] not null default '{}'::text[],
  is_featured boolean not null default false,
  track_stock boolean not null default false,
  available_from timestamptz,
  available_until timestamptz,
  display_order integer not null default 0,
  status text not null default 'active' check (status in ('draft','active','inactive')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.product_branch_availability (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  is_available boolean not null default true,
  price_override numeric(12,2) check (price_override >= 0),
  stock_quantity integer check (stock_quantity >= 0),
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (product_id, branch_id)
);

create table public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name_ar text not null,
  name_en text,
  is_required boolean not null default false,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (max_select >= min_select)
);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.product_option_groups(id) on delete cascade,
  name_ar text not null,
  name_en text,
  display_order integer not null default 0,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.product_options(id) on delete cascade,
  name_ar text not null,
  name_en text,
  price_delta numeric(12,2) not null default 0,
  is_default boolean not null default false,
  display_order integer not null default 0,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.profiles(id),
  branch_id uuid not null references public.branches(id),
  parking_spot_id uuid references public.parking_spots(id),
  vehicle_id uuid references public.customer_vehicles(id),
  fulfillment_type text not null check (fulfillment_type in ('car','window','inside')),
  arrival_confirmed_at timestamptz,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','payment_failed','paid','confirmed','preparing','ready','out_for_delivery','delivered','cancelled','refunded','partially_refunded')),
  currency char(3) not null default 'SAR',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  service_fee numeric(12,2) not null default 0 check (service_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  payment_method text not null check (payment_method in ('online','cash')),
  coupon_id uuid,
  reward_id uuid,
  customer_note text,
  cancellation_reason text,
  idempotency_key text not null unique,
  placed_at timestamptz not null default timezone('utc', now()),
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name_ar text not null,
  sku text,
  quantity integer not null check (quantity between 1 and 99),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  options_total numeric(12,2) not null default 0,
  line_total numeric(12,2) not null check (line_total >= 0),
  station text not null default 'coffee',
  customer_note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  option_value_id uuid references public.product_option_values(id),
  name_ar text not null,
  price_delta numeric(12,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider text not null,
  provider_payment_id text,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'SAR',
  status text not null default 'pending' check (status in ('pending','authorized','paid','failed','cancelled','refunded','partially_refunded')),
  idempotency_key text not null unique,
  provider_response jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique nulls not distinct (provider, provider_payment_id)
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null default false,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  order_id uuid not null references public.orders(id),
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  provider_refund_id text,
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  requested_by uuid references public.profiles(id),
  idempotency_key text not null unique,
  provider_response jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id),
  name_ar text not null,
  required_cups integer not null default 6 check (required_cups between 1 and 100),
  minimum_spend numeric(12,2) not null default 12 check (minimum_spend >= 0),
  reward_max_value numeric(12,2) not null default 25 check (reward_max_value >= 0),
  customer_pays_difference boolean not null default true,
  extras_included boolean not null default false,
  cups_expire_days integer,
  reward_expire_days integer not null default 30,
  partial_reward_payment_earns_cup boolean not null default false,
  residual_spend_earns_cup boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.branch_settings
  add constraint branch_settings_loyalty_fk
  foreign key (loyalty_program_id) references public.loyalty_programs(id) on delete set null;

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.loyalty_programs(id),
  cup_balance integer not null default 0 check (cup_balance >= 0),
  lifetime_cups integer not null default 0 check (lifetime_cups >= 0),
  level text not null default 'member',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (customer_id, program_id)
);

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.loyalty_accounts(id),
  customer_id uuid not null references public.profiles(id),
  branch_id uuid references public.branches(id),
  order_id uuid references public.orders(id),
  type text not null check (type in ('cup_earned','cup_reversed','reward_redeemed','reward_cancelled','admin_adjustment')),
  cups_delta integer not null default 0,
  balance_before integer not null check (balance_before >= 0),
  balance_after integer not null check (balance_after >= 0),
  actor_id uuid references public.profiles(id),
  reason text,
  source text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index loyalty_one_earned_cup_per_order_idx
  on public.loyalty_transactions(order_id)
  where type = 'cup_earned';

create unique index loyalty_one_reversal_per_order_idx
  on public.loyalty_transactions(order_id)
  where type = 'cup_reversed';

create table public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.loyalty_accounts(id),
  customer_id uuid not null references public.profiles(id),
  source_transaction_id uuid not null unique references public.loyalty_transactions(id),
  max_value numeric(12,2) not null,
  status text not null default 'available' check (status in ('available','reserved','redeemed','expired','cancelled')),
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.orders
  add constraint orders_reward_fk foreign key (reward_id) references public.loyalty_rewards(id);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.loyalty_rewards(id),
  order_id uuid not null references public.orders(id),
  customer_id uuid not null references public.profiles(id),
  amount_applied numeric(12,2) not null check (amount_applied >= 0),
  idempotency_key text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  unique (reward_id, order_id)
);

create table public.customer_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.sticker_categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  slug text not null unique,
  display_order integer not null default 0,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.stickers (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.sticker_categories(id),
  name_ar text not null,
  asset_path text not null,
  keywords text[] not null default '{}'::text[],
  is_free boolean not null default true,
  is_global boolean not null default true,
  is_seasonal boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  requires_unlock boolean not null default false,
  rights_confirmed boolean not null default false,
  display_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','active','inactive')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.sticker_branch_availability (
  sticker_id uuid not null references public.stickers(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (sticker_id, branch_id)
);

create table public.sticker_unlock_rules (
  id uuid primary key default gen_random_uuid(),
  sticker_id uuid not null references public.stickers(id) on delete cascade,
  rule_type text not null,
  rule_config jsonb not null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.customer_unlocked_stickers (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  sticker_id uuid not null references public.stickers(id) on delete cascade,
  rule_id uuid references public.sticker_unlock_rules(id),
  reason text,
  unlocked_at timestamptz not null default timezone('utc', now()),
  unique (customer_id, sticker_id)
);

create table public.customer_assets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  original_path text not null,
  processed_path text,
  mime_type text not null check (mime_type in ('image/png','image/webp','image/jpeg')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  width integer check (width > 0),
  height integer check (height > 0),
  processing_status text not null default 'uploaded' check (processing_status in ('uploaded','processing','completed','failed','rejected')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','flagged')),
  rejection_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  is_private boolean not null default true,
  processing_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.card_designs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  active_version_id uuid,
  is_active boolean not null default false,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.card_design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.card_designs(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  canvas_width integer not null check (canvas_width between 300 and 2400),
  canvas_height integer not null check (canvas_height between 180 and 1600),
  elements jsonb not null default '[]'::jsonb,
  background jsonb not null default '{}'::jsonb,
  validation_result jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  unique (design_id, version_number)
);

alter table public.card_designs
  add constraint card_design_active_version_fk
  foreign key (active_version_id) references public.card_design_versions(id) deferrable initially deferred;

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  discount_type text not null check (discount_type in ('fixed','percentage','free_product','bogo','category','first_order')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  max_discount numeric(12,2),
  minimum_order numeric(12,2) not null default 0,
  branch_id uuid references public.branches(id),
  category_id uuid references public.categories(id),
  product_id uuid references public.products(id),
  customer_id uuid references public.profiles(id),
  loyalty_level text,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  usage_limit_per_customer integer not null default 1,
  single_use boolean not null default false,
  status text not null default 'active' check (status in ('draft','active','paused','expired')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

alter table public.orders
  add constraint orders_coupon_fk foreign key (coupon_id) references public.coupons(id);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id),
  customer_id uuid not null references public.profiles(id),
  order_id uuid not null unique references public.orders(id),
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id),
  name text not null,
  template_id uuid,
  audience_definition jsonb not null,
  coupon_id uuid references public.coupons(id),
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','completed','failed','cancelled')),
  target_count integer not null default 0,
  sent_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  redemption_count integer not null default 0,
  attributed_revenue numeric(12,2) not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.campaign_audiences (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  consent_snapshot boolean not null,
  exclusion_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (campaign_id, customer_id)
);

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  provider_template_id text,
  name text not null unique,
  category text not null,
  language text not null default 'ar',
  body_template text not null,
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected','inactive')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.campaigns
  add constraint campaigns_template_fk foreign key (template_id) references public.whatsapp_templates(id);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  order_id uuid references public.orders(id),
  campaign_id uuid references public.campaigns(id),
  template_id uuid references public.whatsapp_templates(id),
  provider_message_id text unique,
  destination text not null,
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed')),
  failure_reason text,
  provider_response jsonb,
  idempotency_key text not null unique,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.campaign_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  audience_id uuid not null references public.campaign_audiences(id) on delete cascade,
  whatsapp_message_id uuid references public.whatsapp_messages(id),
  status text not null default 'queued',
  created_at timestamptz not null default timezone('utc', now()),
  unique (campaign_id, audience_id)
);

create table public.customer_marketing_consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','sms','email','push')),
  consented boolean not null,
  consent_text_version text not null,
  source text not null,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (customer_id, channel)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  type text not null,
  title_ar text not null,
  body_ar text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  branch_id uuid references public.branches(id),
  old_data jsonb,
  new_data jsonb,
  reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id),
  key text not null,
  value jsonb not null,
  is_secret boolean not null default false,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique nulls not distinct (branch_id, key)
);

create table public.media_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id),
  branch_id uuid references public.branches(id),
  bucket text not null,
  object_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 text,
  visibility text not null default 'private' check (visibility in ('public','private')),
  status text not null default 'active' check (status in ('uploading','active','quarantined','deleted')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique (bucket, object_path)
);

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  key text not null,
  actor_id uuid,
  request_hash text,
  response jsonb,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  expires_at timestamptz not null default timezone('utc', now()) + interval '24 hours',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (scope, key)
);

create index profiles_phone_idx on public.profiles(phone) where deleted_at is null;
create index branches_location_idx on public.branches(latitude, longitude) where deleted_at is null;
create index products_category_status_idx on public.products(category_id, status, display_order) where deleted_at is null;
create index product_branch_lookup_idx on public.product_branch_availability(branch_id, product_id, is_available);
create index orders_branch_status_created_idx on public.orders(branch_id, status, created_at desc);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index order_history_order_created_idx on public.order_status_history(order_id, created_at);
create index payments_order_idx on public.payments(order_id, created_at desc);
create index loyalty_transactions_customer_idx on public.loyalty_transactions(customer_id, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create index audit_logs_actor_created_idx on public.audit_logs(actor_id, created_at desc);
create index audit_logs_table_record_idx on public.audit_logs(table_name, record_id, created_at desc);
create index customer_assets_customer_idx on public.customer_assets(customer_id, created_at desc) where deleted_at is null;
create index card_designs_customer_idx on public.card_designs(customer_id, created_at desc) where deleted_at is null;
create index campaign_messages_status_idx on public.campaign_messages(campaign_id, status);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','roles','branches','branch_staff','branch_settings','parking_spots',
    'customer_vehicles','categories','products','product_branch_availability',
    'product_option_groups','product_options','product_option_values','orders',
    'payments','refunds','loyalty_programs','loyalty_accounts','loyalty_rewards',
    'sticker_categories','stickers','customer_assets','card_designs','coupons',
    'campaigns','whatsapp_templates','whatsapp_messages','system_settings',
    'media_files','idempotency_keys'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

insert into public.roles(code, name_ar) values
  ('super_admin','المدير العام'),
  ('branch_manager','مدير الفرع'),
  ('cashier','الكاشير'),
  ('barista','الباريستا'),
  ('car_delivery','موظف تسليم السيارات'),
  ('marketing','مسؤول التسويق'),
  ('accountant','المحاسب'),
  ('customer','العميل')
on conflict (code) do nothing;

insert into public.permissions(code, name_ar, domain) values
  ('system.manage','إدارة النظام','system'),
  ('settings.manage','إدارة الإعدادات','system'),
  ('roles.manage','إدارة الأدوار والصلاحيات','staff'),
  ('staff.manage','إدارة الموظفين','staff'),
  ('branches.read','مشاهدة الفروع','branches'),
  ('branches.manage','إدارة الفروع','branches'),
  ('products.read','مشاهدة المنتجات','catalog'),
  ('products.manage','إدارة المنتجات','catalog'),
  ('orders.read','مشاهدة الطلبات','orders'),
  ('orders.manage','إدارة الطلبات','orders'),
  ('orders.prepare','تحضير الطلبات','orders'),
  ('orders.deliver','تسليم الطلبات','orders'),
  ('payments.read','مشاهدة المدفوعات','finance'),
  ('payments.refund','تنفيذ الاسترجاع','finance'),
  ('customers.read','مشاهدة العملاء','customers'),
  ('loyalty.read','مشاهدة الولاء','loyalty'),
  ('loyalty.adjust','تعديل الولاء','loyalty'),
  ('stickers.manage','إدارة الملصقات','stickers'),
  ('assets.review','مراجعة صور العملاء','stickers'),
  ('marketing.manage','إدارة الحملات والكوبونات','marketing'),
  ('reports.read','مشاهدة التقارير','reports'),
  ('reports.export','تصدير التقارير','reports'),
  ('audit.read','مشاهدة سجل العمليات','audit')
on conflict (code) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'super_admin'
on conflict do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r join public.permissions p on p.code = any(array[
  'branches.read','staff.manage','products.read','products.manage','orders.read',
  'orders.manage','customers.read','loyalty.read','stickers.manage','reports.read'
])
where r.code = 'branch_manager'
on conflict do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r join public.permissions p on p.code = any(array[
  'branches.read','products.read','orders.read','orders.manage','customers.read','loyalty.read'
])
where r.code = 'cashier'
on conflict do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code = any(array[
  'branches.read','products.read','orders.read','orders.prepare'
]) where r.code = 'barista'
on conflict do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code = any(array[
  'branches.read','orders.read','orders.deliver'
]) where r.code = 'car_delivery'
on conflict do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code = any(array[
  'customers.read','stickers.manage','marketing.manage'
]) where r.code = 'marketing'
on conflict do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code = any(array[
  'orders.read','payments.read','payments.refund','reports.read','reports.export'
]) where r.code = 'accountant'
on conflict do nothing;

commit;
