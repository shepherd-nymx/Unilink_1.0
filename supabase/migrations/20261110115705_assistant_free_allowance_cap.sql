-- Separate operational quota; no customer, shop, order or existing RLS changes.
create schema if not exists assistant_private;
revoke all on schema assistant_private from public;
grant usage on schema assistant_private to anon, authenticated;

create table assistant_private.budget_settings (
  singleton boolean primary key default true check (singleton),
  token_sha256 text not null check (token_sha256 ~ '^[a-f0-9]{64}$')
);
create table assistant_private.monthly_usage (
  period date primary key,
  reserved_requests integer not null default 0 check (reserved_requests between 0 and 500)
);
alter table assistant_private.budget_settings enable row level security;
alter table assistant_private.monthly_usage enable row level security;
revoke all on all tables in schema assistant_private from public, anon, authenticated;

-- Only a server holding the separately configured random token can reserve budget.
-- This authenticates the backend, independently of the app's legacy customer sessions.
create function assistant_private.reserve_request(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  expected text;
  reserved integer;
begin
  if p_token is null or length(p_token) <> 64 then return false; end if;
  select token_sha256 into expected from assistant_private.budget_settings where singleton;
  if expected is null or encode(sha256(convert_to(p_token, 'UTF8')), 'hex') <> expected then return false; end if;
  insert into assistant_private.monthly_usage(period, reserved_requests)
  values (date_trunc('month', now() at time zone 'UTC')::date, 1)
  on conflict (period) do update
    set reserved_requests = assistant_private.monthly_usage.reserved_requests + 1
    where assistant_private.monthly_usage.reserved_requests < 500
  returning reserved_requests into reserved;
  return reserved is not null;
end;
$$;
revoke all on function assistant_private.reserve_request(text) from public;
grant execute on function assistant_private.reserve_request(text) to anon, authenticated;

-- Public API wrapper has no elevated privileges and exposes no quota/settings rows.
create function public.reserve_shopping_assistant_request(p_token text)
returns boolean language sql security invoker set search_path = '' as $$
  select assistant_private.reserve_request(p_token);
$$;
revoke all on function public.reserve_shopping_assistant_request(text) from public;
grant execute on function public.reserve_shopping_assistant_request(text) to anon, authenticated;
