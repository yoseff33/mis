begin;

create or replace function public.initial_setup_atomic(
  p_admin_user_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  branch_id uuid;
  program_id uuid;
  category_id uuid;
  product_id uuid;
  super_role_id uuid;
begin
  if exists (
    select 1 from public.system_settings
    where key = 'setup_completed' and value = 'true'::jsonb
  ) then
    raise exception using errcode = 'P0001', message = 'تم إعداد النظام مسبقًا';
  end if;

  if not exists (select 1 from public.profiles where id = p_admin_user_id) then
    raise exception using errcode = 'P0002', message = 'حساب المدير غير موجود';
  end if;

  select id into super_role_id from public.roles where code = 'super_admin';
  insert into public.user_roles(user_id, role_id, assigned_by)
  values (p_admin_user_id, super_role_id, p_admin_user_id)
  on conflict do nothing;

  insert into public.branches(
    name_ar, slug, address, latitude, longitude, phone, opening_hours,
    payment_methods, created_by, updated_by
  ) values (
    p_payload#>>'{branch,name}',
    p_payload#>>'{branch,slug}',
    p_payload#>>'{branch,address}',
    nullif(p_payload#>>'{branch,latitude}','')::numeric,
    nullif(p_payload#>>'{branch,longitude}','')::numeric,
    nullif(p_payload#>>'{branch,phone}',''),
    coalesce(p_payload#>'{branch,opening_hours}','{}'::jsonb),
    array(select jsonb_array_elements_text(coalesce(p_payload#>'{payments,methods}','["cash"]'::jsonb))),
    p_admin_user_id,
    p_admin_user_id
  ) returning id into branch_id;

  insert into public.branch_staff(branch_id, user_id, job_title, is_active, created_by)
  values (branch_id, p_admin_user_id, 'المدير العام', true, p_admin_user_id);

  insert into public.loyalty_programs(
    name_ar, required_cups, minimum_spend, reward_max_value,
    reward_expire_days, cups_expire_days
  ) values (
    coalesce(p_payload#>>'{loyalty,name}', 'برنامج الولاء'),
    coalesce((p_payload#>>'{loyalty,required_cups}')::integer, 6),
    coalesce((p_payload#>>'{loyalty,minimum_spend}')::numeric, 12),
    coalesce((p_payload#>>'{loyalty,reward_max_value}')::numeric, 25),
    coalesce((p_payload#>>'{loyalty,reward_expire_days}')::integer, 30),
    nullif(p_payload#>>'{loyalty,cups_expire_days}','')::integer
  ) returning id into program_id;

  insert into public.branch_settings(
    branch_id, tax_rate, cash_enabled, online_payment_enabled, loyalty_program_id
  ) values (
    branch_id,
    coalesce((p_payload->>'tax_rate')::numeric, 0.15),
    coalesce((p_payload#>>'{payments,cash_enabled}')::boolean, true),
    coalesce((p_payload#>>'{payments,online_enabled}')::boolean, false),
    program_id
  );

  insert into public.parking_spots(branch_id, code, name_ar, location_hint, created_by)
  values (
    branch_id,
    p_payload#>>'{parking,code}',
    p_payload#>>'{parking,name}',
    nullif(p_payload#>>'{parking,location_hint}',''),
    p_admin_user_id
  );

  insert into public.categories(name_ar, slug, status, created_by, updated_by)
  values (
    p_payload#>>'{category,name}',
    p_payload#>>'{category,slug}',
    'active',
    p_admin_user_id,
    p_admin_user_id
  ) returning id into category_id;

  insert into public.products(
    category_id, name_ar, slug, description_ar, base_price, sku, status,
    created_by, updated_by
  ) values (
    category_id,
    p_payload#>>'{product,name}',
    p_payload#>>'{product,slug}',
    nullif(p_payload#>>'{product,description}',''),
    (p_payload#>>'{product,price}')::numeric,
    nullif(p_payload#>>'{product,sku}',''),
    'active',
    p_admin_user_id,
    p_admin_user_id
  ) returning id into product_id;

  insert into public.product_branch_availability(product_id, branch_id, is_available)
  values (product_id, branch_id, true);

  insert into public.system_settings(key, value, is_secret, created_by, updated_by)
  values
    ('coffee_identity', jsonb_build_object(
      'name', p_payload->>'coffee_name',
      'currency', 'SAR',
      'locale', 'ar-SA'
    ), false, p_admin_user_id, p_admin_user_id),
    ('payment_settings', coalesce(p_payload->'payments','{}'::jsonb), true, p_admin_user_id, p_admin_user_id),
    ('whatsapp_settings', coalesce(p_payload->'whatsapp','{}'::jsonb), true, p_admin_user_id, p_admin_user_id),
    ('sticker_settings', '{"max_card_elements":30,"customer_assets_private":true}'::jsonb, false, p_admin_user_id, p_admin_user_id),
    ('setup_completed', 'true'::jsonb, false, p_admin_user_id, p_admin_user_id);

  perform public.record_audit_event(
    'initial_setup', 'system_settings', null, branch_id, null,
    jsonb_build_object('coffee_name', p_payload->>'coffee_name'), 'إكمال الإعداد الأول'
  );

  return jsonb_build_object(
    'branch_id', branch_id,
    'loyalty_program_id', program_id,
    'category_id', category_id,
    'product_id', product_id
  );
end;
$$;

create or replace function public.confirm_order_arrival(p_order_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  arrived timestamptz := timezone('utc', now());
begin
  update public.orders
  set arrival_confirmed_at = coalesce(arrival_confirmed_at, arrived)
  where id = p_order_id
    and customer_id = auth.uid()
    and fulfillment_type = 'car'
    and status in ('confirmed','preparing','ready')
  returning arrival_confirmed_at into arrived;
  if not found then
    raise exception using errcode = 'P0001', message = 'لا يمكن تأكيد الوصول لهذا الطلب';
  end if;
  return arrived;
end;
$$;

create or replace function public.adjust_loyalty(
  p_customer_id uuid,
  p_program_id uuid,
  p_cups_delta integer,
  p_reason text,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account public.loyalty_accounts;
  before_balance integer;
  after_balance integer;
begin
  if p_cups_delta = 0 or abs(p_cups_delta) > 20 then
    raise exception using errcode = '22023', message = 'قيمة تعديل الولاء غير صالحة';
  end if;
  if length(trim(coalesce(p_reason,''))) < 4 then
    raise exception using errcode = '22023', message = 'سبب التعديل مطلوب';
  end if;
  if not public.has_permission('loyalty.adjust', p_branch_id) then
    raise exception using errcode = '42501', message = 'ليس لديك صلاحية تعديل الولاء';
  end if;

  insert into public.loyalty_accounts(customer_id, program_id)
  values (p_customer_id, p_program_id)
  on conflict (customer_id, program_id) do update set updated_at = now()
  returning * into account;
  select * into account from public.loyalty_accounts where id = account.id for update;
  before_balance := account.cup_balance;
  after_balance := greatest(before_balance + p_cups_delta, 0);
  update public.loyalty_accounts set cup_balance = after_balance where id = account.id;
  insert into public.loyalty_transactions(
    account_id, customer_id, branch_id, type, cups_delta, balance_before,
    balance_after, actor_id, reason, source
  ) values (
    account.id, p_customer_id, p_branch_id, 'admin_adjustment',
    after_balance - before_balance, before_balance, after_balance,
    auth.uid(), p_reason, 'admin'
  );
  perform public.record_audit_event(
    'loyalty_adjust', 'loyalty_accounts', account.id, p_branch_id,
    jsonb_build_object('cup_balance', before_balance),
    jsonb_build_object('cup_balance', after_balance), p_reason
  );
  return jsonb_build_object('account_id', account.id, 'balance', after_balance);
end;
$$;

grant execute on function public.confirm_order_arrival(uuid) to authenticated;
grant execute on function public.adjust_loyalty(uuid, uuid, integer, text, uuid) to authenticated;
revoke all on function public.initial_setup_atomic(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.initial_setup_atomic(uuid, jsonb) to service_role;

commit;
