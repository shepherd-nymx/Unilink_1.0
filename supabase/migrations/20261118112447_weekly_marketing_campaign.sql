create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.weekly_marketing_config (
  id integer primary key check (id = 1),
  enabled boolean not null default false,
  token_hash text not null
);
create table if not exists public.weekly_marketing_deliveries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  email text not null,
  campaign_week date not null,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  provider_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(campaign_week,email)
);
create table if not exists public.marketing_email_suppressions (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.weekly_marketing_config enable row level security;
alter table public.weekly_marketing_deliveries enable row level security;
alter table public.marketing_email_suppressions enable row level security;
revoke all on public.weekly_marketing_config, public.weekly_marketing_deliveries, public.marketing_email_suppressions from public, anon, authenticated;
grant select,insert,update,delete on public.weekly_marketing_config, public.weekly_marketing_deliveries, public.marketing_email_suppressions to service_role;
create index if not exists weekly_marketing_deliveries_customer_idx on public.weekly_marketing_deliveries(customer_id);

do $setup$
declare campaign_token text;
begin
  if not exists(select 1 from vault.secrets where name = 'unilink_weekly_campaign_token') then
    campaign_token := gen_random_uuid()::text || gen_random_uuid()::text;
    perform vault.create_secret(campaign_token, 'unilink_weekly_campaign_token');
  else
    select decrypted_secret into campaign_token from vault.decrypted_secrets where name = 'unilink_weekly_campaign_token';
  end if;
  insert into public.weekly_marketing_config(id, token_hash)
  values(1, encode(sha256(convert_to(campaign_token,'UTF8')),'hex'))
  on conflict(id) do nothing;
end;
$setup$;

create or replace function public.weekly_marketing_candidates(campaign_week date)
returns table(id uuid, email text, full_name text)
language sql stable security invoker set search_path = ''
as $fn$
 select distinct on (lower(trim(c.email))) c.id, lower(trim(c.email)), c.full_name
 from public.customers c
 join public.marketing_consents m on m.customer_id=c.id and m.opted_in=true
 where c.email is not null and trim(c.email) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 and not exists(select 1 from public.weekly_marketing_deliveries d where d.campaign_week=$1 and d.email=lower(trim(c.email)))
 and not exists(select 1 from public.marketing_email_suppressions s where s.email=lower(trim(c.email)))
 and not exists(select 1 from public.email_notifications n where lower(trim(n.recipient_email))=lower(trim(c.email)) and n.status in ('bounced','complained'))
 order by lower(trim(c.email)), c.id
 limit 20;
$fn$;
revoke all on function public.weekly_marketing_candidates(date) from public, anon, authenticated;
grant execute on function public.weekly_marketing_candidates(date) to service_role;

-- Africa/Harare Monday 09:00-09:50. Repeated polling drains batches without duplicates.
select cron.schedule('unilink-weekly-shopping-reminder','*/10 7 * * 1', $job$
 select net.http_post(
  url := 'https://yysnoiamfoveltvyjzgx.supabase.co/functions/v1/weekly-marketing',
  headers := jsonb_build_object('Content-Type','application/json', 'x-campaign-secret',
    (select decrypted_secret from vault.decrypted_secrets where name='unilink_weekly_campaign_token')),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
 );
$job$);
