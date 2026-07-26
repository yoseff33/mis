begin;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'profiles','roles','permissions','role_permissions','user_roles','branches',
    'branch_staff','branch_settings','parking_spots','customer_vehicles','categories',
    'products','product_branch_availability','product_option_groups','product_options',
    'product_option_values','orders','order_items','order_item_options','order_status_history',
    'payments','payment_events','refunds','loyalty_programs','loyalty_accounts',
    'loyalty_transactions','loyalty_rewards','reward_redemptions','customer_qr_tokens',
    'sticker_categories','stickers','sticker_branch_availability','sticker_unlock_rules',
    'customer_unlocked_stickers','customer_assets','card_designs','card_design_versions',
    'coupons','coupon_redemptions','campaigns','campaign_audiences','campaign_messages',
    'whatsapp_templates','whatsapp_messages','customer_marketing_consents','notifications',
    'audit_logs','system_settings','media_files','idempotency_keys'
  ]
  loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('alter table public.%I force row level security', relation_name);
  end loop;
end;
$$;

create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.has_permission('customers.read'));

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy access_reference_roles on public.roles
for select to authenticated
using (true);
create policy access_reference_permissions on public.permissions
for select to authenticated
using (true);
create policy role_permissions_read on public.role_permissions
for select to authenticated
using (true);
create policy roles_admin_all on public.roles
for all to authenticated
using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));
create policy permissions_admin_all on public.permissions
for all to authenticated
using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));
create policy role_permissions_admin_all on public.role_permissions
for all to authenticated
using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));
create policy user_roles_select on public.user_roles
for select to authenticated
using (user_id = auth.uid() or public.has_permission('roles.manage', branch_id));
create policy user_roles_admin_all on public.user_roles
for all to authenticated
using (public.has_permission('roles.manage', branch_id))
with check (public.has_permission('roles.manage', branch_id));

create policy branches_public_read on public.branches
for select to anon, authenticated
using (status <> 'closed' and deleted_at is null);
create policy branches_manage on public.branches
for all to authenticated
using (public.has_permission('branches.manage', id))
with check (public.has_permission('branches.manage', id));

create policy branch_staff_select on public.branch_staff
for select to authenticated
using (user_id = auth.uid() or public.has_permission('staff.manage', branch_id));
create policy branch_staff_manage on public.branch_staff
for all to authenticated
using (public.has_permission('staff.manage', branch_id))
with check (public.has_permission('staff.manage', branch_id));

create policy branch_settings_public_read on public.branch_settings
for select to anon, authenticated
using (true);
create policy branch_settings_manage on public.branch_settings
for all to authenticated
using (public.has_permission('settings.manage', branch_id))
with check (public.has_permission('settings.manage', branch_id));

create policy parking_public_read on public.parking_spots
for select to anon, authenticated
using (deleted_at is null and status <> 'disabled');
create policy parking_manage on public.parking_spots
for all to authenticated
using (public.has_permission('branches.manage', branch_id))
with check (public.has_permission('branches.manage', branch_id));

create policy vehicles_own_all on public.customer_vehicles
for all to authenticated
using (customer_id = auth.uid() and deleted_at is null)
with check (customer_id = auth.uid());
create policy vehicles_staff_read on public.customer_vehicles
for select to authenticated
using (public.has_permission('orders.read'));

create policy categories_public_read on public.categories
for select to anon, authenticated
using (status = 'active' and deleted_at is null);
create policy categories_manage on public.categories
for all to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage'));

create policy products_public_read on public.products
for select to anon, authenticated
using (status = 'active' and deleted_at is null);
create policy products_manage on public.products
for all to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage'));

create policy product_availability_public_read on public.product_branch_availability
for select to anon, authenticated
using (is_available);
create policy product_availability_manage on public.product_branch_availability
for all to authenticated
using (public.has_permission('products.manage', branch_id))
with check (public.has_permission('products.manage', branch_id));

create policy option_groups_public_read on public.product_option_groups
for select to anon, authenticated using (true);
create policy option_groups_manage on public.product_option_groups
for all to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage'));
create policy options_public_read on public.product_options
for select to anon, authenticated using (status = 'active');
create policy options_manage on public.product_options
for all to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage'));
create policy option_values_public_read on public.product_option_values
for select to anon, authenticated using (status = 'active');
create policy option_values_manage on public.product_option_values
for all to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage'));

create policy orders_customer_read on public.orders
for select to authenticated
using (customer_id = auth.uid());
create policy orders_staff_read on public.orders
for select to authenticated
using (public.has_permission('orders.read', branch_id));

create policy order_items_read on public.order_items
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id
    and (o.customer_id = auth.uid() or public.has_permission('orders.read', o.branch_id))
));
create policy order_item_options_read on public.order_item_options
for select to authenticated
using (exists (
  select 1 from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = order_item_id
    and (o.customer_id = auth.uid() or public.has_permission('orders.read', o.branch_id))
));
create policy order_history_read on public.order_status_history
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id
    and (o.customer_id = auth.uid() or public.has_permission('orders.read', o.branch_id))
));

create policy payments_customer_read on public.payments
for select to authenticated
using (exists (
  select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()
));
create policy payments_staff_read on public.payments
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and public.has_permission('payments.read', o.branch_id)
));
create policy payment_events_finance_read on public.payment_events
for select to authenticated
using (exists (
  select 1 from public.payments p
  join public.orders o on o.id = p.order_id
  where p.id = payment_id and public.has_permission('payments.read', o.branch_id)
));
create policy refunds_customer_read on public.refunds
for select to authenticated
using (exists (
  select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()
));
create policy refunds_finance_read on public.refunds
for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and public.has_permission('payments.read', o.branch_id)
));

create policy loyalty_programs_public_read on public.loyalty_programs
for select to anon, authenticated using (status = 'active');
create policy loyalty_programs_manage on public.loyalty_programs
for all to authenticated
using (public.has_permission('settings.manage', branch_id))
with check (public.has_permission('settings.manage', branch_id));
create policy loyalty_accounts_read on public.loyalty_accounts
for select to authenticated
using (customer_id = auth.uid() or public.has_permission('loyalty.read'));
create policy loyalty_transactions_read on public.loyalty_transactions
for select to authenticated
using (customer_id = auth.uid() or public.has_permission('loyalty.read', branch_id));
create policy loyalty_rewards_read on public.loyalty_rewards
for select to authenticated
using (customer_id = auth.uid() or public.has_permission('loyalty.read'));
create policy reward_redemptions_read on public.reward_redemptions
for select to authenticated
using (customer_id = auth.uid() or public.has_permission('loyalty.read'));
create policy qr_tokens_own_read on public.customer_qr_tokens
for select to authenticated using (customer_id = auth.uid());

create policy sticker_categories_public_read on public.sticker_categories
for select to anon, authenticated using (status = 'active');
create policy sticker_categories_manage on public.sticker_categories
for all to authenticated
using (public.has_permission('stickers.manage'))
with check (public.has_permission('stickers.manage'));
create policy stickers_public_read on public.stickers
for select to anon, authenticated
using (
  status = 'active' and deleted_at is null
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
  and (not requires_unlock or exists (
    select 1 from public.customer_unlocked_stickers cus
    where cus.sticker_id = id and cus.customer_id = auth.uid()
  ))
);
create policy stickers_manage on public.stickers
for all to authenticated
using (public.has_permission('stickers.manage'))
with check (public.has_permission('stickers.manage'));
create policy sticker_branch_public_read on public.sticker_branch_availability
for select to anon, authenticated using (true);
create policy sticker_branch_manage on public.sticker_branch_availability
for all to authenticated
using (public.has_permission('stickers.manage', branch_id))
with check (public.has_permission('stickers.manage', branch_id));
create policy unlock_rules_public_read on public.sticker_unlock_rules
for select to authenticated using (status = 'active');
create policy unlock_rules_manage on public.sticker_unlock_rules
for all to authenticated
using (public.has_permission('stickers.manage'))
with check (public.has_permission('stickers.manage'));
create policy unlocked_stickers_own_read on public.customer_unlocked_stickers
for select to authenticated using (customer_id = auth.uid());

create policy customer_assets_own_all on public.customer_assets
for all to authenticated
using (customer_id = auth.uid() and deleted_at is null)
with check (customer_id = auth.uid());
create policy customer_assets_review on public.customer_assets
for select to authenticated
using (public.has_permission('assets.review'));
create policy customer_assets_review_update on public.customer_assets
for update to authenticated
using (public.has_permission('assets.review'))
with check (public.has_permission('assets.review'));
create policy card_designs_own_all on public.card_designs
for all to authenticated
using (customer_id = auth.uid() and deleted_at is null)
with check (customer_id = auth.uid());
create policy card_versions_own_read on public.card_design_versions
for select to authenticated
using (exists (
  select 1 from public.card_designs d where d.id = design_id and d.customer_id = auth.uid()
));

create policy coupons_customer_read on public.coupons
for select to authenticated
using (
  status = 'active' and deleted_at is null
  and (customer_id is null or customer_id = auth.uid())
);
create policy coupons_manage on public.coupons
for all to authenticated
using (public.has_permission('marketing.manage', branch_id))
with check (public.has_permission('marketing.manage', branch_id));
create policy coupon_redemptions_customer_read on public.coupon_redemptions
for select to authenticated
using (customer_id = auth.uid() or public.has_permission('marketing.manage'));

create policy campaigns_marketing_all on public.campaigns
for all to authenticated
using (public.has_permission('marketing.manage', branch_id))
with check (public.has_permission('marketing.manage', branch_id));
create policy campaign_audiences_marketing_all on public.campaign_audiences
for all to authenticated
using (exists (
  select 1 from public.campaigns c
  where c.id = campaign_id and public.has_permission('marketing.manage', c.branch_id)
))
with check (exists (
  select 1 from public.campaigns c
  where c.id = campaign_id and public.has_permission('marketing.manage', c.branch_id)
));
create policy campaign_messages_marketing_all on public.campaign_messages
for all to authenticated
using (exists (
  select 1 from public.campaigns c
  where c.id = campaign_id and public.has_permission('marketing.manage', c.branch_id)
))
with check (exists (
  select 1 from public.campaigns c
  where c.id = campaign_id and public.has_permission('marketing.manage', c.branch_id)
));
create policy whatsapp_templates_marketing_all on public.whatsapp_templates
for all to authenticated
using (public.has_permission('marketing.manage'))
with check (public.has_permission('marketing.manage'));
create policy whatsapp_messages_read on public.whatsapp_messages
for select to authenticated
using (customer_id = auth.uid() or public.has_permission('marketing.manage'));
create policy consents_own_all on public.customer_marketing_consents
for all to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());
create policy consents_marketing_read on public.customer_marketing_consents
for select to authenticated
using (public.has_permission('marketing.manage'));

create policy notifications_own_read on public.notifications
for select to authenticated
using (user_id = auth.uid() or (
  user_id is null and branch_id is not null and public.has_branch_access(branch_id)
));
create policy notifications_own_update on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy audit_read on public.audit_logs
for select to authenticated
using (public.has_permission('audit.read', branch_id));
create policy settings_public_read on public.system_settings
for select to anon, authenticated
using (not is_secret);
create policy settings_admin_all on public.system_settings
for all to authenticated
using (public.has_permission('settings.manage', branch_id))
with check (public.has_permission('settings.manage', branch_id));
create policy media_owner_read on public.media_files
for select to authenticated
using (
  visibility = 'public' or owner_id = auth.uid()
  or (branch_id is not null and public.has_branch_access(branch_id))
);
create policy media_manage on public.media_files
for all to authenticated
using (
  owner_id = auth.uid()
  or public.has_permission('products.manage', branch_id)
  or public.has_permission('stickers.manage', branch_id)
)
with check (
  owner_id = auth.uid()
  or public.has_permission('products.manage', branch_id)
  or public.has_permission('stickers.manage', branch_id)
);

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.has_permission('system.manage') then
    if new.member_number is distinct from old.member_number
       or new.phone is distinct from old.phone
       or new.email is distinct from old.email
       or new.status is distinct from old.status then
      raise exception using errcode = '42501', message = 'لا يمكن تعديل بيانات الهوية الحساسة من الملف الشخصي';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_sensitive_fields
before update on public.profiles
for each row execute function public.protect_profile_fields();

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using errcode = '42501', message = 'سجل العمليات غير قابل للتعديل أو الحذف';
end;
$$;

create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function public.prevent_audit_mutation();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images','product-images',true,10485760,array['image/png','image/webp','image/jpeg']),
  ('sticker-assets','sticker-assets',true,5242880,array['image/png','image/webp']),
  ('customer-assets','customer-assets',false,20971520,array['image/png','image/webp','image/jpeg']),
  ('branch-assets','branch-assets',true,10485760,array['image/png','image/webp','image/jpeg']),
  ('brand-assets','brand-assets',true,10485760,array['image/png','image/webp','image/jpeg']),
  ('exports','exports',false,104857600,array['text/csv','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storage_public_assets_read on storage.objects
for select to anon, authenticated
using (bucket_id in ('product-images','sticker-assets','branch-assets','brand-assets'));

create policy storage_customer_assets_read on storage.objects
for select to authenticated
using (
  bucket_id = 'customer-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy storage_customer_assets_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'customer-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('png','webp','jpg','jpeg')
);

create policy storage_customer_assets_update on storage.objects
for update to authenticated
using (
  bucket_id = 'customer-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'customer-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy storage_customer_assets_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'customer-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy storage_product_write on storage.objects
for all to authenticated
using (bucket_id in ('product-images','branch-assets','brand-assets') and public.has_permission('products.manage'))
with check (
  bucket_id in ('product-images','branch-assets','brand-assets')
  and public.has_permission('products.manage')
  and lower(storage.extension(name)) in ('png','webp','jpg','jpeg')
);

create policy storage_sticker_write on storage.objects
for all to authenticated
using (bucket_id = 'sticker-assets' and public.has_permission('stickers.manage'))
with check (
  bucket_id = 'sticker-assets'
  and public.has_permission('stickers.manage')
  and lower(storage.extension(name)) in ('png','webp')
);

create policy storage_exports_read on storage.objects
for select to authenticated
using (
  bucket_id = 'exports'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.has_permission('reports.read'))
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_status_history'
  ) then
    alter publication supabase_realtime add table public.order_status_history;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;
end;
$$;

commit;
