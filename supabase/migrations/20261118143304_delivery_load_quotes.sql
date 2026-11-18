-- Additive, inactive-by-default delivery quote workflow. Existing rates are not invented.
alter table public.shop_products add column if not exists weight_kg numeric check(weight_kg>0), add column if not exists volume_litres numeric check(volume_litres>0), add column if not exists package_size text check(package_size in ('compact','bag','bulky')), add column if not exists fragile boolean not null default false, add column if not exists two_person_lift boolean not null default false;
create table public.delivery_pricing_settings(id boolean primary key default true check(id), enabled boolean not null default false);
insert into public.delivery_pricing_settings values(true,false);
create table public.delivery_rate_cards(transport text primary key check(transport in ('walking','bicycle','motorcycle','car','van','truck')),base_fee numeric check(base_fee>=0),per_km numeric check(per_km>=0),max_weight_kg numeric check(max_weight_kg>0),max_volume_litres numeric check(max_volume_litres>0),enabled boolean not null default false,updated_at timestamptz not null default now());
insert into public.delivery_rate_cards(transport) select unnest(array['walking','bicycle','motorcycle','car','van','truck']);
create table public.driver_delivery_capacity(driver_id uuid primary key references public.drivers(id),transport text not null references public.delivery_rate_cards(transport),max_weight_kg numeric not null check(max_weight_kg>0),max_volume_litres numeric not null check(max_volume_litres>0),two_person_lift boolean not null default false);
create table public.delivery_quotes(id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.customers(id),shop_id uuid not null references public.shops(id),basket jsonb not null,products jsonb not null,subtotal numeric not null,ecocash_fee_at_quote numeric not null default 0,weight_kg numeric,volume_litres numeric,fragile boolean not null,two_person_lift boolean not null,latitude numeric not null,longitude numeric not null,status text not null default 'requested' check(status in ('requested','proposed','driver_accepted','accepted','consumed','cancelled')),driver_id uuid references public.drivers(id),transport text,road_km numeric check(road_km>=0),route_evidence text,delivery_fee numeric check(delivery_fee>=0),suggested_fee numeric,explanation text,expires_at timestamptz,created_at timestamptz not null default now(),accepted_at timestamptz);
create index on public.delivery_quotes(customer_id,created_at desc);
create index on public.delivery_quotes(driver_id,status);
alter table public.shop_orders add column if not exists delivery_quote_id uuid unique references public.delivery_quotes(id), add column if not exists delivery_terms jsonb;

-- Legacy profile tables have permissive write policies. Never authorize money/quotes
-- using their editable auth_id fields. Snapshot established links into a private registry.
create schema if not exists delivery_private;
revoke all on schema delivery_private from public,anon,authenticated;
create table delivery_private.identities(user_id uuid primary key references auth.users(id) on delete cascade,customer_id uuid unique references public.customers(id) on delete set null,driver_id uuid unique references public.drivers(id) on delete set null);
insert into delivery_private.identities(user_id,customer_id)
 select c.auth_id,c.id from public.customers c join auth.users u on u.id=c.auth_id and u.email_confirmed_at is not null where c.auth_id in(select auth_id from public.customers where auth_id is not null group by auth_id having count(*)=1);
insert into delivery_private.identities(user_id,driver_id)
 select d.auth_id,d.id from public.drivers d join auth.users u on u.id=d.auth_id and u.email_confirmed_at is not null where d.auth_id in(select auth_id from public.drivers where auth_id is not null group by auth_id having count(*)=1)
 on conflict(user_id) do update set driver_id=excluded.driver_id;
create function public.delivery_quote_identity() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('customer_id',customer_id,'driver_id',driver_id) from delivery_private.identities where user_id=auth.uid()$$;
revoke all on function public.delivery_quote_identity() from public,anon;
grant execute on function public.delivery_quote_identity() to authenticated;

alter table public.delivery_pricing_settings enable row level security;
alter table public.delivery_rate_cards enable row level security;
alter table public.driver_delivery_capacity enable row level security;
alter table public.delivery_quotes enable row level security;
revoke all on public.delivery_pricing_settings,public.delivery_rate_cards,public.driver_delivery_capacity,public.delivery_quotes from public,anon,authenticated;
grant select on public.delivery_pricing_settings,public.delivery_rate_cards to anon,authenticated;
create policy pricing_read on public.delivery_pricing_settings for select to anon,authenticated using(true);
create policy rates_read on public.delivery_rate_cards for select to anon,authenticated using(true);
grant select on public.delivery_quotes to authenticated;
create policy quotes_customer_read on public.delivery_quotes for select to authenticated using(customer_id=((select public.delivery_quote_identity())->>'customer_id')::uuid);
grant all on public.delivery_pricing_settings,public.delivery_rate_cards,public.driver_delivery_capacity,public.delivery_quotes to service_role;

-- All write APIs verify identity/credentials inside the function; no public table writes.
create function public.request_delivery_quote(p_shop uuid,p_items jsonb,p_lat numeric,p_lng numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid; q public.delivery_quotes; line jsonb; p public.shop_products; n int; basket_snapshot jsonb:='[]'; product_snapshot jsonb:='[]'; subtotal numeric:=0; weight numeric:=0; volume numeric:=0; frag boolean:=false; lift boolean:=false;
begin
 select customer_id into cid from delivery_private.identities where user_id=auth.uid(); if cid is null then raise exception 'Sign in with your verified customer account to request a delivery quote.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,0));
 if not (select enabled from public.delivery_pricing_settings where id) then raise exception 'Weight and distance quoting is not active yet.'; end if;
 if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Confirm a valid delivery GPS location.'; end if;
 if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid basket.'; end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_items)x)<>jsonb_array_length(p_items) then raise exception 'Combine duplicate product quantities.'; end if;
 if not exists(select 1 from public.shops where id=p_shop and status='active') then raise exception 'Shop unavailable.'; end if;
 for line in select value from jsonb_array_elements(p_items) order by value->>'id' loop
 n:=(line->>'qty')::integer; if n is null or n not between 1 and 1000 then raise exception 'Invalid quantity.'; end if;
 select * into p from public.shop_products where id=(line->>'id')::uuid and shop_id=p_shop and status='active' and is_available is not false;
 if p.id is null or p.stock<n then raise exception 'A product is unavailable or has insufficient stock.'; end if;
 basket_snapshot:=basket_snapshot||jsonb_build_array(jsonb_build_object('id',p.id,'qty',n));
 product_snapshot:=product_snapshot||jsonb_build_array(jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'qty',n,'weight_kg',p.weight_kg,'volume_litres',p.volume_litres,'package_size',p.package_size,'fragile',p.fragile,'two_person_lift',p.two_person_lift));
 subtotal:=subtotal+p.price*n;
 if p.weight_kg is null or p.package_size is null then weight:=null; else weight:=weight+p.weight_kg*n; end if;
 if p.volume_litres is null or p.package_size is null then volume:=null; else volume:=volume+p.volume_litres*n; end if;
 frag:=frag or p.fragile; lift:=lift or p.two_person_lift;
 end loop;
 select * into q from public.delivery_quotes dq where dq.customer_id=cid and dq.shop_id=p_shop and dq.basket=basket_snapshot and dq.products=product_snapshot and dq.latitude=p_lat and dq.longitude=p_lng and dq.status in ('requested','proposed','driver_accepted','accepted') and (dq.expires_at is null or dq.expires_at>now()) order by dq.created_at desc limit 1;
 if q.id is not null then return to_jsonb(q); end if;
 insert into public.delivery_quotes(customer_id,shop_id,basket,products,subtotal,weight_kg,volume_litres,fragile,two_person_lift,latitude,longitude,ecocash_fee_at_quote,expires_at) values(cid,p_shop,basket_snapshot,product_snapshot,subtotal,weight,volume,frag,lift,p_lat,p_lng,(select coalesce(ecocash_fee,0) from public.shops where id=p_shop),now()+interval '24 hours') returning * into q;
 return to_jsonb(q);
end $$;
revoke all on function public.request_delivery_quote(uuid,jsonb,numeric,numeric) from public,anon;
grant execute on function public.request_delivery_quote(uuid,jsonb,numeric,numeric) to authenticated;

-- Reauthentication supports the existing custom admin login without trusting a client admin ID.
create function public.manage_delivery_pricing(p_username text,p_password text,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.delivery_quotes; cap public.driver_delivery_capacity; rate public.delivery_rate_cards; aid uuid; fee numeric; distance numeric;
begin
 select id into aid from public.verify_admin_login(p_username,p_password); if aid is null then raise exception 'Admin credentials required.'; end if;
 if p_action='identity' then
 if not exists(select 1 from auth.users u where u.id=(p_data->>'user_id')::uuid and u.email_confirmed_at is not null and (exists(select 1 from public.customers c where c.id=(p_data->>'customer_id')::uuid and lower(trim(c.email))=lower(trim(u.email))) or exists(select 1 from public.drivers d where d.id=(p_data->>'driver_id')::uuid and lower(trim(d.email))=lower(trim(u.email))))) then raise exception 'Verify the account and matching email first.'; end if;
 if p_data->>'customer_id' is not null and not exists(select 1 from public.customers c join auth.users u on lower(trim(c.email))=lower(trim(u.email)) where c.id=(p_data->>'customer_id')::uuid and u.id=(p_data->>'user_id')::uuid) then raise exception 'Customer email does not match.'; end if;
 if p_data->>'driver_id' is not null and not exists(select 1 from public.drivers d join auth.users u on lower(trim(d.email))=lower(trim(u.email)) where d.id=(p_data->>'driver_id')::uuid and u.id=(p_data->>'user_id')::uuid) then raise exception 'Messenger email does not match.'; end if;
 insert into delivery_private.identities(user_id,customer_id,driver_id) values((p_data->>'user_id')::uuid,(p_data->>'customer_id')::uuid,(p_data->>'driver_id')::uuid) on conflict(user_id) do update set customer_id=coalesce(delivery_private.identities.customer_id,excluded.customer_id),driver_id=coalesce(delivery_private.identities.driver_id,excluded.driver_id);
 elsif p_action='rates' then
 insert into public.delivery_rate_cards(transport,base_fee,per_km,max_weight_kg,max_volume_litres,enabled) values(p_data->>'transport',(p_data->>'base_fee')::numeric,(p_data->>'per_km')::numeric,(p_data->>'max_weight_kg')::numeric,(p_data->>'max_volume_litres')::numeric,false)
 on conflict(transport) do update set base_fee=excluded.base_fee,per_km=excluded.per_km,max_weight_kg=excluded.max_weight_kg,max_volume_litres=excluded.max_volume_litres,enabled=false,updated_at=now();
 -- Explicit activation only after all four values are supplied.
 update public.delivery_rate_cards set enabled=coalesce((p_data->>'enabled')::boolean,false) where transport=p_data->>'transport' and base_fee is not null and per_km is not null and max_weight_kg is not null and max_volume_litres is not null;
 elsif p_action='enable' then
 update public.delivery_pricing_settings set enabled=(p_data->>'enabled')::boolean where id;
 elsif p_action='capacity' then
 if not exists(select 1 from public.drivers where id=(p_data->>'driver_id')::uuid and approval_status='approved' and suspended is not true) then raise exception 'Choose an approved messenger.'; end if;
 insert into public.driver_delivery_capacity values((p_data->>'driver_id')::uuid,p_data->>'transport',(p_data->>'max_weight_kg')::numeric,(p_data->>'max_volume_litres')::numeric,coalesce((p_data->>'two_person_lift')::boolean,false)) on conflict(driver_id) do update set transport=excluded.transport,max_weight_kg=excluded.max_weight_kg,max_volume_litres=excluded.max_volume_litres,two_person_lift=excluded.two_person_lift;
 elsif p_action='propose' then
 select * into q from public.delivery_quotes where id=(p_data->>'id')::uuid for update;
 if q.id is null or q.status not in ('requested','proposed') then raise exception 'This quote is locked. Request a new quote for a price change.'; end if;
 select * into cap from public.driver_delivery_capacity where driver_id=(p_data->>'driver_id')::uuid;
 if cap.driver_id is null then raise exception 'Configure the messenger transport and capacity first.'; end if;
 if (q.weight_kg is not null and q.weight_kg>cap.max_weight_kg) or (q.volume_litres is not null and q.volume_litres>cap.max_volume_litres) or (q.two_person_lift and not cap.two_person_lift) then raise exception 'This load exceeds the messenger capacity.'; end if;
 if not exists(select 1 from public.drivers where id=cap.driver_id and exists(select 1 from delivery_private.identities i where i.driver_id=public.drivers.id) and approval_status='approved' and suspended is not true and is_available and subscription_status is distinct from 'expired' and (subscription_expiry is null or subscription_expiry>now())) then raise exception 'Messenger must be available, approved and linked to verified sign-in.'; end if;
 distance:=(p_data->>'road_km')::numeric; fee:=(p_data->>'delivery_fee')::numeric;
 if distance is null or distance<0 or fee is null or fee<0 or fee<>round(fee,2) or length(trim(coalesce(p_data->>'route_evidence','')))<8 or length(trim(coalesce(p_data->>'explanation','')))<8 then raise exception 'Enter the verified road distance, route evidence, fee to two decimals and explanation.'; end if;
 select * into rate from public.delivery_rate_cards where transport=cap.transport and enabled;
 update public.delivery_quotes set driver_id=cap.driver_id,transport=cap.transport,road_km=distance,route_evidence=p_data->>'route_evidence',delivery_fee=fee,
 suggested_fee=case when rate.transport is not null and q.weight_kg is not null and q.volume_litres is not null and q.weight_kg<=rate.max_weight_kg and q.volume_litres<=rate.max_volume_litres and not q.two_person_lift then round(rate.base_fee+rate.per_km*distance,2) else null end,
 explanation=p_data->>'explanation',expires_at=now()+interval '24 hours',status='proposed' where id=q.id;
 elsif p_action<>'list' then raise exception 'Unknown action.';
 end if;
 return jsonb_build_object('settings',(select to_jsonb(s) from public.delivery_pricing_settings s where id),'rates',(select jsonb_agg(r) from public.delivery_rate_cards r),'capacities',(select jsonb_agg(c) from public.driver_delivery_capacity c),'quotes',(select jsonb_agg(quote_row) from (select * from public.delivery_quotes order by created_at desc limit 100)quote_row));
end $$;
revoke all on function public.manage_delivery_pricing(text,text,text,jsonb) from public;
grant execute on function public.manage_delivery_pricing(text,text,text,jsonb) to anon,authenticated;

create function public.driver_delivery_quotes() returns setof public.delivery_quotes language sql security definer set search_path='' as $$
 select q.* from public.delivery_quotes q join public.drivers d on d.id=q.driver_id join public.driver_delivery_capacity c on c.driver_id=d.id where exists(select 1 from delivery_private.identities i where i.driver_id=d.id and i.user_id=auth.uid()) and d.approval_status='approved' and d.suspended is not true and d.is_available and d.subscription_status is distinct from 'expired' and (d.subscription_expiry is null or d.subscription_expiry>now()) and c.transport=q.transport and q.status='proposed' and q.expires_at>now() and (q.weight_kg is null or q.weight_kg<=c.max_weight_kg) and (q.volume_litres is null or q.volume_litres<=c.max_volume_litres) and (not q.two_person_lift or c.two_person_lift);
$$;
create function public.respond_delivery_quote(p_id uuid,p_accept boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.delivery_quotes;
begin
 select * into q from public.delivery_quotes where id=p_id for update;
 if q.id is null then raise exception 'Quote not found.'; end if;
 if q.expires_at is null or q.expires_at<=now() then raise exception 'Quote expired. Request another quote.'; end if;
 if not p_accept and q.status in ('requested','proposed','driver_accepted','accepted') and exists(select 1 from delivery_private.identities where customer_id=q.customer_id and user_id=auth.uid()) then
 update public.delivery_quotes set status='cancelled' where id=p_id;
 elsif q.status='proposed' and exists(select 1 from public.driver_delivery_quotes() where id=p_id) then
 update public.delivery_quotes set status=case when p_accept then 'driver_accepted' else 'cancelled' end where id=p_id;
 elsif q.status='driver_accepted' and exists(select 1 from delivery_private.identities where customer_id=q.customer_id and user_id=auth.uid()) then
 update public.delivery_quotes set status=case when p_accept then 'accepted' else 'cancelled' end,accepted_at=case when p_accept then now() else null end where id=p_id;
 else raise exception 'This quote cannot be accepted by this account.'; end if;
 select * into q from public.delivery_quotes where id=p_id; return to_jsonb(q);
end $$;
revoke all on function public.driver_delivery_quotes(),public.respond_delivery_quote(uuid,boolean) from public,anon;
grant execute on function public.driver_delivery_quotes(),public.respond_delivery_quote(uuid,boolean) to authenticated;

create function public.place_quoted_shop_order(p_quote uuid,p_method text,p_address text,p_ecocash_pop text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.delivery_quotes; o public.shop_orders; s public.shops; line jsonb; p public.shop_products; check_result jsonb; eco numeric:=0;
begin
 select * into q from public.delivery_quotes where id=p_quote for update;
 if q.id is null or not exists(select 1 from delivery_private.identities where customer_id=q.customer_id and user_id=auth.uid()) then raise exception 'Verified customer sign-in required.'; end if;
 if q.status<>'accepted' or q.expires_at<=now() then raise exception 'Accept a current delivery quote first.'; end if;
 select * into s from public.shops where id=q.shop_id;
 check_result:=public.validate_shop_order(q.shop_id); if s.status<>'active' or s.is_available is false or check_result->>'allowed'='false' then raise exception 'Shop is unavailable.'; end if;
 if not public.validate_shop_payment(q.shop_id,p_method) then raise exception 'Payment method unavailable.'; end if;
 if exists(select 1 from public.shop_customer_blacklist where shop_id=q.shop_id and customer_id=q.customer_id) then raise exception 'Shop cannot accept this order.'; end if;
 if not exists(select 1 from public.drivers d join public.driver_delivery_capacity c on c.driver_id=d.id where d.id=q.driver_id and d.approval_status='approved' and d.suspended is not true and d.is_available and d.subscription_status is distinct from 'expired' and (d.subscription_expiry is null or d.subscription_expiry>now()) and c.transport=q.transport and (q.weight_kg is null or q.weight_kg<=c.max_weight_kg) and (q.volume_litres is null or q.volume_litres<=c.max_volume_litres) and (not q.two_person_lift or c.two_person_lift)) then raise exception 'Messenger availability or capacity changed. Request another quote.'; end if;
 if length(trim(coalesce(p_address,'')))<3 then raise exception 'Enter the delivery address.'; end if;
 for line in select value from jsonb_array_elements(q.products) loop
 select * into p from public.shop_products where id=(line->>'id')::uuid for update;
 if p.id is null or p.status<>'active' or p.is_available is false or p.stock<(line->>'qty')::int or p.price<>(line->>'price')::numeric or p.weight_kg is distinct from (line->>'weight_kg')::numeric or p.volume_litres is distinct from (line->>'volume_litres')::numeric or p.package_size is distinct from line->>'package_size' or p.fragile is distinct from (line->>'fragile')::boolean or p.two_person_lift is distinct from (line->>'two_person_lift')::boolean then raise exception 'Product details changed. Request a new quote.'; end if;
 end loop;
 if p_method='ecocash' then if coalesce(s.ecocash_fee,0)<>q.ecocash_fee_at_quote then raise exception 'Payment fees changed. Request a new quote.'; end if; eco:=q.ecocash_fee_at_quote; end if;
 perform set_config('unilink.quoted_checkout',auth.uid()::text,true);
 insert into public.shop_orders(customer_id,shop_id,products,total_amount,delivery_fee,ecocash_fee_amount,ecocash_pop,delivery_location,delivery_latitude,delivery_longitude,payment_method,status,messenger_id,customer_email,customer_name,customer_phone,delivery_quote_id,delivery_terms)
 select q.customer_id,q.shop_id,q.products,q.subtotal+q.delivery_fee+eco,q.delivery_fee,eco,p_ecocash_pop,p_address,q.latitude,q.longitude,p_method,'pending',q.driver_id,c.email,c.full_name,c.phone_number,q.id,jsonb_build_object('road_km',q.road_km,'transport',q.transport,'weight_kg',q.weight_kg,'volume_litres',q.volume_litres,'fragile',q.fragile,'two_person_lift',q.two_person_lift,'explanation',q.explanation,'route_evidence',q.route_evidence,'accepted_at',q.accepted_at) from public.customers c where c.id=q.customer_id returning * into o;
 update public.delivery_quotes set status='consumed' where id=q.id;
 return to_jsonb(o);
end $$;
revoke all on function public.place_quoted_shop_order(uuid,text,text,text) from public,anon;
grant execute on function public.place_quoted_shop_order(uuid,text,text,text) to authenticated;

-- Enforce accepted terms against direct client writes and legacy assignment APIs.
create function public.guard_delivery_quote_order() returns trigger language plpgsql security definer set search_path='' as $$
declare q public.delivery_quotes;
begin
 if TG_OP='UPDATE' and old.delivery_quote_id is not null then
 if new.delivery_quote_id is distinct from old.delivery_quote_id or new.delivery_fee is distinct from old.delivery_fee or new.total_amount is distinct from old.total_amount or new.products is distinct from old.products or new.delivery_terms is distinct from old.delivery_terms or new.messenger_id is distinct from old.messenger_id or new.delivery_latitude is distinct from old.delivery_latitude or new.delivery_longitude is distinct from old.delivery_longitude or new.delivery_location is distinct from old.delivery_location or new.shop_id is distinct from old.shop_id or new.customer_id is distinct from old.customer_id or new.ecocash_fee_amount is distinct from old.ecocash_fee_amount or new.payment_method is distinct from old.payment_method then raise exception 'Agreed delivery terms are locked. Cancel and request a new quote for changes.'; end if;
 return new;
 end if;
 if new.delivery_quote_id is null then
 if TG_OP='INSERT' and (select enabled from public.delivery_pricing_settings where id) then raise exception 'An accepted delivery quote is required.'; end if;
 return new;
 end if;
 select * into q from public.delivery_quotes where id=new.delivery_quote_id for update;
 if q.id is null or q.status<>'accepted' or q.expires_at<=now() or not exists(select 1 from delivery_private.identities where customer_id=q.customer_id and user_id=auth.uid()) or new.customer_id is distinct from q.customer_id or new.shop_id is distinct from q.shop_id or new.products is distinct from q.products or new.delivery_fee is distinct from q.delivery_fee or new.messenger_id is distinct from q.driver_id or new.delivery_latitude is distinct from q.latitude or new.delivery_longitude is distinct from q.longitude or new.status<>'pending' or new.ecocash_fee_amount is distinct from (case when new.payment_method='ecocash' then q.ecocash_fee_at_quote else 0 end) or new.total_amount is distinct from q.subtotal+q.delivery_fee+coalesce(new.ecocash_fee_amount,0) then raise exception 'Order does not match accepted quote.'; end if;
 if current_setting('unilink.quoted_checkout',true) is distinct from auth.uid()::text then raise exception 'Use the verified quote checkout.'; end if;
 return new;
end $$;
revoke all on function public.guard_delivery_quote_order() from public,anon,authenticated;
create trigger guard_delivery_quote_order before insert or update on public.shop_orders for each row execute function public.guard_delivery_quote_order();

-- Multi-shop quote checkout is atomic; a failed shop does not leave partial purchases.
create function public.place_quoted_shop_orders(p_quotes uuid[],p_method text,p_address text,p_ecocash_pop text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare qid uuid; o jsonb; result jsonb:='{}';
begin
 if array_length(p_quotes,1) is null or array_length(p_quotes,1) not between 1 and 25 or (select count(distinct x) from unnest(p_quotes)x)<>array_length(p_quotes,1) then raise exception 'Invalid delivery quotes.'; end if;
 for qid in select unnest(p_quotes) order by 1 loop
 o:=public.place_quoted_shop_order(qid,p_method,p_address,p_ecocash_pop);
 if result ? (o->>'shop_id') then raise exception 'Use one quote per shop.'; end if;
 result:=result||jsonb_build_object(o->>'shop_id',o);
 end loop;
 return result;
end $$;
revoke all on function public.place_quoted_shop_orders(uuid[],text,text,text) from public,anon;
grant execute on function public.place_quoted_shop_orders(uuid[],text,text,text) to authenticated;

alter table public.shop_products add constraint product_load_finite check ((weight_kg is null or weight_kg::text not in ('NaN','Infinity','-Infinity')) and (volume_litres is null or volume_litres::text not in ('NaN','Infinity','-Infinity')));
alter table public.delivery_rate_cards add constraint rate_card_finite check (coalesce(base_fee::text,'') not in ('NaN','Infinity','-Infinity') and coalesce(per_km::text,'') not in ('NaN','Infinity','-Infinity') and coalesce(max_weight_kg::text,'') not in ('NaN','Infinity','-Infinity') and coalesce(max_volume_litres::text,'') not in ('NaN','Infinity','-Infinity'));
alter table public.driver_delivery_capacity add constraint driver_capacity_finite check(max_weight_kg::text not in ('NaN','Infinity','-Infinity') and max_volume_litres::text not in ('NaN','Infinity','-Infinity'));
alter table public.delivery_quotes add constraint delivery_quote_finite check(coalesce(delivery_fee::text,'') not in ('NaN','Infinity','-Infinity') and coalesce(road_km::text,'') not in ('NaN','Infinity','-Infinity') and latitude::text not in ('NaN','Infinity','-Infinity') and longitude::text not in ('NaN','Infinity','-Infinity'));
