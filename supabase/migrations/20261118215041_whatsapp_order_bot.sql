-- Native WhatsApp ordering. Only signed Meta webhooks reach the service-only RPCs.
create table public.whatsapp_bot_config(id boolean primary key default true check(id),enabled boolean not null default false,worker_token_hash text not null);
create table public.whatsapp_bot_sessions(wa_id text primary key check(wa_id ~ '^[0-9]{8,15}$'),state jsonb not null default '{}',updated_at timestamptz not null default now(),last_message_at timestamptz not null default now());
create table public.whatsapp_bot_customers(wa_id text primary key references public.whatsapp_bot_sessions(wa_id),customer_id uuid not null references public.customers(id) on delete cascade,linked_at timestamptz not null default now());
create table public.whatsapp_bot_inbox(message_id text primary key,wa_id text not null references public.whatsapp_bot_sessions(wa_id),kind text not null,response jsonb not null,created_at timestamptz not null default now());
create table public.whatsapp_bot_outbox(id uuid primary key default gen_random_uuid(),message_id text unique not null references public.whatsapp_bot_inbox(message_id),wa_id text not null,payload jsonb not null,status text not null default 'queued' check(status in('queued','sending','sent','failed','uncertain','expired')),attempts int not null default 0,next_attempt_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '23 hours',provider_message_id text,last_error text,created_at timestamptz not null default now());
create index whatsapp_bot_outbox_pending on public.whatsapp_bot_outbox(next_attempt_at) where status='queued';
create index whatsapp_bot_sessions_recent on public.whatsapp_bot_sessions(updated_at desc);
create table public.whatsapp_bot_orders(order_id uuid primary key references public.shop_orders(id) on delete cascade,wa_id text not null references public.whatsapp_bot_sessions(wa_id),checkout_id uuid unique not null,payment_started boolean not null default false,payment_url text,created_at timestamptz not null default now());
create index whatsapp_bot_orders_owner on public.whatsapp_bot_orders(wa_id,created_at desc);
create table public.whatsapp_bot_stock(order_id uuid not null references public.shop_orders(id) on delete cascade,product_id uuid not null references public.shop_products(id) on delete cascade,qty int not null check(qty>0),returned boolean not null default false,primary key(order_id,product_id));
do $setup$
declare t text; secret_value text;
begin
 foreach t in array array['whatsapp_bot_config','whatsapp_bot_sessions','whatsapp_bot_customers','whatsapp_bot_inbox','whatsapp_bot_outbox','whatsapp_bot_orders','whatsapp_bot_stock'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 if not exists(select 1 from vault.secrets where name='unilink_whatsapp_worker_token') then perform vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'unilink_whatsapp_worker_token');end if;
 select decrypted_secret into secret_value from vault.decrypted_secrets where name='unilink_whatsapp_worker_token';
 insert into public.whatsapp_bot_config(id,worker_token_hash) values(true,encode(sha256(convert_to(secret_value,'UTF8')),'hex'));
end $setup$;

create function public.whatsapp_bot_review(p_wa_id text) returns jsonb language plpgsql security invoker set search_path='' as $review$
declare st jsonb; s public.shops; p public.shop_products; line jsonb; n int; items jsonb:='[]'; subtotal numeric:=0; fee numeric; eco numeric:=0; cid uuid; policy text;
begin
 select state into st from public.whatsapp_bot_sessions where wa_id=p_wa_id;
 if (select enabled from public.delivery_pricing_settings where id) then raise exception 'Delivery quotes are required. Contact UniLink for a reviewed quote before ordering.';end if;
 select * into s from public.shops where id=(st->>'shop_id')::uuid;
 if s.id is null or s.status<>'active' or not s.is_available or public.validate_shop_order(s.id)->>'allowed'='false' then raise exception 'This shop is unavailable or closed.';end if;
 if not exists(select 1 from public.shop_service_locations l where l.shop_id=s.id and length(trim(l.location_name))>0 and strpos(lower(st->>'town'),lower(trim(l.location_name)))>0) then raise exception 'This shop does not serve your selected town.';end if;
 if length(coalesce(st->>'address','')) not between 3 and 300 or length(coalesce(st->>'name','')) not between 2 and 80 or st->>'latitude' is null or st->>'longitude' is null or (st->>'latitude')::numeric not between -90 and 90 or (st->>'longitude')::numeric not between -180 and 180 then raise exception 'Confirm your name, delivery address and shared GPS location first.';end if;
 if jsonb_array_length(coalesce(st->'cart','[]')) not between 1 and 30 then raise exception 'Add between 1 and 30 different products first.';end if;
 if not public.validate_shop_payment(s.id,st->>'payment') then raise exception 'This shop no longer accepts that payment method.';end if;
 select customer_id into cid from public.whatsapp_bot_customers where wa_id=p_wa_id;
 if cid is not null and exists(select 1 from public.shop_customer_blacklist where shop_id=s.id and customer_id=cid) then raise exception 'The shop cannot accept this order. Contact support.';end if;
 for line in select value from jsonb_array_elements(st->'cart') order by value->>'id' loop
  n:=(line->>'qty')::int;
  select * into p from public.shop_products where id=(line->>'id')::uuid and shop_id=s.id for update;
  if p.id is null or p.status<>'active' or p.is_available is false or n not between 1 and 1000 or p.stock<n or p.price<0 or p.price::text in('NaN','Infinity','-Infinity') then raise exception 'A product changed or has insufficient stock. Review your basket.';end if;
  subtotal:=subtotal+p.price*n;items:=items||jsonb_build_array(jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'qty',n));
 end loop;
 select t.fee into fee from public.shop_delivery_fee_tiers t where t.shop_id=s.id and subtotal>=t.min_amount and (t.max_amount is null or subtotal<t.max_amount) order by t.min_amount limit 1;
 fee:=coalesce(fee,s.delivery_fee,0);
 if fee<0 or fee::text in('NaN','Infinity','-Infinity') then raise exception 'Shop delivery pricing needs review.';end if;
 if st->>'payment'='ecocash' then
  if nullif(trim(s.ecocash_number),'') is null then raise exception 'The shop has not supplied EcoCash payment details.';end if;
  eco:=coalesce(s.ecocash_fee,0);
 end if;
 select version into policy from public.terms_and_conditions where is_active order by created_at desc limit 1;
 if policy is null then raise exception 'UniLink terms are unavailable. Contact support.';end if;
 return jsonb_build_object('shop_id',s.id,'shop_name',s.name,'products',items,'subtotal',round(subtotal,2),'delivery_fee',round(fee,2),'ecocash_fee',round(eco,2),'total',round(subtotal+fee+eco,2),'payment',st->>'payment','terms_version',policy,'ecocash_number',case when st->>'payment'='ecocash' then s.ecocash_number end,'ecocash_name',case when st->>'payment'='ecocash' then s.ecocash_name end);
end $review$;
revoke all on function public.whatsapp_bot_review(text) from public,anon,authenticated;
grant execute on function public.whatsapp_bot_review(text) to service_role;

create function public.whatsapp_bot_restore_stock() returns trigger language plpgsql security definer set search_path='' as $stock$
declare reservation record;
begin
 if new.status='cancelled' and old.status is distinct from new.status then
  for reservation in select * from public.whatsapp_bot_stock where order_id=new.id and not returned order by product_id for update loop
   update public.shop_products set stock=stock+reservation.qty where id=reservation.product_id;
   update public.whatsapp_bot_stock set returned=true where order_id=new.id and product_id=reservation.product_id;
  end loop;
 end if;return new;
end $stock$;
revoke all on function public.whatsapp_bot_restore_stock() from public,anon,authenticated;
create trigger whatsapp_bot_restore_stock after update of status on public.shop_orders for each row execute function public.whatsapp_bot_restore_stock();

create function public.whatsapp_bot_message(p_message_id text,p_wa_id text,p_kind text,p_text text default '',p_lat numeric default null,p_lng numeric default null,p_profile_name text default '',p_timestamp timestamptz default now()) returns jsonb language plpgsql security invoker set search_path='' as $bot$
declare st jsonb; reply jsonb; choices jsonb:='[]'; txt text:=trim(coalesce(p_text,'')); action text; answer text; step text; r record; s public.shops; p public.shop_products; review jsonb; old_review jsonb; line jsonb; cid uuid; oid uuid; checkout uuid; count_rows int; page int:=0; n int; policy text; event_id uuid; menu boolean:=false;
begin
 if p_wa_id !~ '^[0-9]{8,15}$' or length(p_message_id) not between 1 and 200 or p_kind not in('text','interactive','location','unsupported') or length(txt)>2048 or p_timestamp<now()-interval '23 hours' or p_timestamp>now()+interval '5 minutes' then raise exception 'Invalid WhatsApp message.';end if;
 if not (select enabled from public.whatsapp_bot_config where id) then return jsonb_build_object('disabled',true);end if;
 perform pg_advisory_xact_lock(hashtextextended('whatsapp:'||p_wa_id,0));
 select response into reply from public.whatsapp_bot_inbox where message_id=p_message_id;
 if found then return reply;end if;
 insert into public.whatsapp_bot_sessions(wa_id) values(p_wa_id) on conflict do nothing;
 select state into st from public.whatsapp_bot_sessions where wa_id=p_wa_id for update;
 if (select updated_at from public.whatsapp_bot_sessions where wa_id=p_wa_id)<now()-interval '24 hours' then st:='{}';end if;
 step:=coalesce(st->>'step','menu');action:=lower(txt);
 if step not in('quantity','town','address','name','receipt') and txt ~ '^[1-9][0-9]?$' and coalesce(jsonb_array_length(st->'choices'),0)>0 then action:=st->'choices'->((txt::int)-1)->>'id';end if;
 if action ~ '^(shop|product|order|cancel_order):' and split_part(action,':',2) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then action:='invalid';end if;
 if action ~ '^(products|shops):' and split_part(action,':',2) !~ '^[0-9]{1,4}$' then action:='invalid';end if;
 if p_kind='unsupported' then answer:='Please use text, the menu buttons, or WhatsApp location sharing. I cannot read voice notes or images yet.';
 elsif action in('help','support') then
  answer:='UniLink support: unilinkbase@gmail.com or +263782627990. Include your order reference. Never send passwords, card details, PINs or verification codes. Reply MENU to continue.';
 elsif action in('cancel','/cancel','clear') then
  st:=jsonb_build_object('step','menu','town',st->>'town');answer:='Your unsubmitted basket is cleared. This does not cancel an order already placed.';menu:=true;
 elsif action in('hi','hello','start','menu','/menu') or (st='{}'::jsonb and p_kind<>'location') then menu:=true;answer:='Welcome to UniLink! Shop from registered stores and order here in WhatsApp. Choose an option.';
 elsif action='town' then st:=st||'{"step":"town"}';answer:='Which town or area should your shop serve? For example: Harare or Bulawayo.';
 elsif step='town' then
  if length(txt) not between 2 and 100 then answer:='Enter your town or area (2–100 characters).';else st:=st||jsonb_build_object('town',txt,'step','menu');action:='shops';end if;
 elsif action='orders' then
  for r in select o.id,o.status,o.total_amount from public.whatsapp_bot_orders w join public.shop_orders o on o.id=w.order_id where w.wa_id=p_wa_id order by w.created_at desc limit 8 loop
   choices:=choices||jsonb_build_array(jsonb_build_object('id','order:'||r.id,'title','#'||left(r.id::text,8),'description',r.status||' · $'||to_char(r.total_amount,'FM999999990.00')));
  end loop;
  answer:=case when jsonb_array_length(choices)=0 then 'You have not placed any WhatsApp orders yet. Orders from another account are never shown here.' else 'Your latest WhatsApp orders:' end;st:=st||'{"step":"orders"}';
 elsif action like 'order:%' then
  select o.* into r from public.shop_orders o join public.whatsapp_bot_orders w on w.order_id=o.id where w.wa_id=p_wa_id and o.id=substring(action from 7)::uuid;
  if not found then answer:='Order not found for this WhatsApp account.';
  else answer:='Order #'||left(r.id::text,8)||E'\nStatus: '||r.status||E'\nTotal: $'||to_char(r.total_amount,'FM999999990.00')||E'\nPayment method: '||r.payment_method;
   if r.payment_method='paynow' then
    select payment_url into policy from public.whatsapp_bot_orders where order_id=r.id and wa_id=p_wa_id;
    answer:=answer||E'\n'||case when policy is null then 'Payment link not confirmed. Contact UniLink before paying.' else 'Secure Paynow link: '||policy||'. Ask the shop to confirm receipt; a link is not proof of payment.' end;
   end if;
   if r.status='pending' then choices:=jsonb_build_array(jsonb_build_object('id','cancel_order:'||r.id,'title','Cancel this order'));end if;
  end if;
 elsif action like 'cancel_order:%' then
  update public.shop_orders o set status='cancelled',cancelled_at=now(),updated_at=now() where o.id=substring(action from 14)::uuid and o.status='pending' and exists(select 1 from public.whatsapp_bot_orders w where w.order_id=o.id and w.wa_id=p_wa_id) returning o.id into oid;
  answer:=case when oid is null then 'This order cannot be cancelled here. Contact support.' else 'Order cancelled. If you already paid, contact support for refund assistance; no refund has been claimed automatically.' end;
 elsif action like 'shop:%' then
  select * into s from public.shops where id=substring(action from 6)::uuid and status='active' and is_available;
  if s.id is null or not exists(select 1 from public.shop_service_locations l where l.shop_id=s.id and length(trim(l.location_name))>0 and strpos(lower(st->>'town'),lower(trim(l.location_name)))>0) then answer:='Shop unavailable for your selected town. Choose SHOPS again.';
  else st:=st||jsonb_build_object('shop_id',s.id,'shop_name',s.name,'cart','[]'::jsonb,'step','products');action:='products:0';end if;
 elsif action like 'product:%' then
  select * into p from public.shop_products where id=substring(action from 9)::uuid and shop_id=(st->>'shop_id')::uuid and status='active' and is_available is not false and stock>0;
  if p.id is null then answer:='That product is unavailable. Choose products again.';
  else st:=st||jsonb_build_object('step','quantity','product_id',p.id);answer:=left(p.name,60)||' costs $'||to_char(p.price,'FM999999990.00')||' per unit. How many in total? Send a number from 1 to '||least(p.stock,1000)||'.';end if;
 elsif step='quantity' then
  select * into p from public.shop_products where id=(st->>'product_id')::uuid and shop_id=(st->>'shop_id')::uuid and status='active' and is_available is not false;
  n:=case when txt ~ '^[1-9][0-9]{0,3}$' then txt::int else null end;
  if n is null or p.id is null or n>least(p.stock,1000) then answer:='Enter an available whole-number quantity, or reply CANCEL to clear the basket.';
  else
   select coalesce(jsonb_agg(value),'[]') into choices from jsonb_array_elements(coalesce(st->'cart','[]')) where value->>'id'<>p.id::text;
   if jsonb_array_length(choices)>=30 then answer:='Use at most 30 different products per order.';
   else st:=st||jsonb_build_object('cart',choices||jsonb_build_array(jsonb_build_object('id',p.id,'qty',txt::int)),'step','cart');action:='cart';end if;choices:='[]';
  end if;
 elsif action='checkout' then
  if coalesce(jsonb_array_length(st->'cart'),0)=0 then answer:='Your basket is empty. Add a product first.';
  elsif st->>'latitude' is null or st->>'longitude' is null then st:=st||'{"step":"location"}';reply:=jsonb_build_object('kind','location_request');answer:='Share the delivery location using WhatsApp location sharing. Use the actual delivery destination.';
  elsif length(coalesce(st->>'address',''))<3 then st:=st||'{"step":"address"}';answer:='Enter delivery details: house/flat number, street and a helpful landmark for the GPS location you shared.';
  elsif length(coalesce(st->>'name',''))<2 then st:=st||'{"step":"name"}';answer:='What full name should the shop use for this order?';
  else action:='payment_menu';end if;
 elsif step='location' and p_kind='location' then
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then answer:='Please share a valid delivery GPS location.';
  else st:=st||jsonb_build_object('latitude',p_lat,'longitude',p_lng,'step','address');answer:='Enter delivery details: house/flat number, street and a helpful landmark for that GPS location.';end if;
 elsif step='address' then
  if length(txt) not between 3 and 300 then answer:='Use 3–300 characters for the delivery address.';
  else st:=st||jsonb_build_object('address',txt,'step','name');answer:='What full name should the shop use for this order?';end if;
 elsif step='name' then
  if length(txt) not between 2 and 80 then answer:='Enter your name using 2–80 characters.';
  else st:=st||jsonb_build_object('name',txt);action:='payment_menu';end if;
 elsif action like 'payment:%' then
  if substring(action from 9) not in('pay_on_delivery','ecocash','paynow') then answer:='Choose an offered payment method.';
  else st:=st||jsonb_build_object('payment',substring(action from 9));
   if st->>'payment'='ecocash' then
    select * into s from public.shops where id=(st->>'shop_id')::uuid;
    st:=st||'{"step":"receipt"}';answer:='EcoCash merchant: '||coalesce(s.ecocash_name,s.name)||E'\nNumber/code: '||coalesce(s.ecocash_number,'Not supplied — contact shop')||E'\nEnter your payment reference if already paid, or type LATER to arrange payment with the shop. A typed reference is not proof that payment was received.';
   else action:='review';end if;
  end if;
 elsif step='receipt' then
  if length(txt) not between 1 and 200 then answer:='Enter a reference up to 200 characters or LATER.';
  else st:=st||jsonb_build_object('receipt',case when lower(txt)='later' then null else txt end);action:='review';end if;
 elsif action='agree' and step='terms' then
  st:=st||jsonb_build_object('terms_agreed',st->>'terms_offered');action:='review';
 elsif action='confirm' and step='review' then
  begin
   update public.whatsapp_bot_sessions set state=st where wa_id=p_wa_id;
   review:=public.whatsapp_bot_review(p_wa_id);old_review:=st->'review';
   if review is distinct from old_review then action:='review';answer:='Prices, stock, fees or terms changed. Review the updated total and confirm again.';
   elsif st->>'terms_agreed' is distinct from review->>'terms_version' then action:='review';
   else
    select customer_id into cid from public.whatsapp_bot_customers where wa_id=p_wa_id;
    if cid is null then
     if exists(select 1 from public.customers c where regexp_replace(c.phone_number,'[^0-9]','','g') in(p_wa_id,case when p_wa_id like '263%' then '0'||substring(p_wa_id from 4) else p_wa_id end)) then
      st:=st||'{"step":"account_link"}';answer:='This number already has a UniLink account. Contact unilinkbase@gmail.com or +263782627990 to verify and link that account once. We will not expose existing orders just from a typed phone number. Your basket is saved; reply CHECKOUT after support links it.';
     else
      insert into public.customers(username,phone_number,full_name,latitude,longitude,phone_verified,terms_accepted,terms_version,terms_accepted_at) values('wa_'||p_wa_id,'+'||p_wa_id,st->>'name',(st->>'latitude')::numeric,(st->>'longitude')::numeric,true,true,review->>'terms_version',now()) returning id into cid;
      insert into public.whatsapp_bot_customers(wa_id,customer_id) values(p_wa_id,cid);
     end if;
    end if;
    if cid is not null then
     checkout:=(st->>'checkout_id')::uuid;
     select order_id into oid from public.whatsapp_bot_orders where checkout_id=checkout and wa_id=p_wa_id;
     if oid is null then
      update public.customers set terms_accepted=true,terms_version=review->>'terms_version',terms_accepted_at=now() where id=cid and (terms_accepted is not true or terms_version is distinct from review->>'terms_version');
      insert into public.shop_orders(customer_id,shop_id,products,total_amount,delivery_fee,ecocash_fee_amount,ecocash_pop,delivery_location,delivery_latitude,delivery_longitude,payment_method,status,customer_name,customer_phone,customer_email,order_note)
      select cid,(review->>'shop_id')::uuid,review->'products',(review->>'total')::numeric,(review->>'delivery_fee')::numeric,(review->>'ecocash_fee')::numeric,st->>'receipt',st->>'address',(st->>'latitude')::numeric,(st->>'longitude')::numeric,review->>'payment','pending',st->>'name','+'||p_wa_id,c.email,'Placed in UniLink WhatsApp bot' from public.customers c where c.id=cid returning id into oid;
      insert into public.whatsapp_bot_orders(order_id,wa_id,checkout_id) values(oid,p_wa_id,checkout);
      for line in select value from jsonb_array_elements(review->'products') loop
       update public.shop_products set stock=stock-(line->>'qty')::int where id=(line->>'id')::uuid;
       insert into public.whatsapp_bot_stock(order_id,product_id,qty) values(oid,(line->>'id')::uuid,(line->>'qty')::int);
      end loop;
     end if;
     answer:='Order #'||left(oid::text,8)||' received by '||left(review->>'shop_name',80)||E'.\nTotal: $'||to_char((review->>'total')::numeric,'FM999999990.00')||E'\nPayment: '||(review->>'payment')||E'\nThe shop must confirm availability and prepare the order. Use My orders for updates.';
     reply:=jsonb_build_object('order_id',oid,'paynow',review->>'payment'='paynow');st:=jsonb_build_object('step','menu','town',st->>'town','name',st->>'name','last_order_id',oid);menu:=true;
    end if;
   end if;
  exception when others then answer:=case when sqlstate='23505' then 'This account needs a support check before ordering. Your order was not placed.' else sqlerrm end;end;
 end if;

 -- Resolve navigation actions after collecting the next required field.
 if (action='shops' or action like 'shops:%') and answer is null then
  page:=case when action='shops' then 0 else least(substring(action from 7)::int,1000) end;
  if nullif(trim(st->>'town'),'') is null then st:=st||'{"step":"town"}';answer:='Which town or area should the shops serve?';
  else
   for r in select sh.id,sh.name,sh.category from public.shops sh where sh.status='active' and sh.is_available and exists(select 1 from public.shop_service_locations l where l.shop_id=sh.id and length(trim(l.location_name))>0 and strpos(lower(st->>'town'),lower(trim(l.location_name)))>0) order by sh.name,sh.id offset page limit 7 loop
    choices:=choices||jsonb_build_array(jsonb_build_object('id','shop:'||r.id,'title',r.name,'description',coalesce(r.category,'Shop')));
   end loop;
   answer:=case when jsonb_array_length(choices)=0 then 'No available shops serve that area yet. Choose Change town or contact support.' else 'Choose a shop serving '||(st->>'town')||'. Each shop is a separate order and delivery.' end;
   if jsonb_array_length(choices)=7 then choices:=choices||jsonb_build_array(jsonb_build_object('id','shops:'||(page+7),'title','More shops'));end if;
   choices:=choices||jsonb_build_array(jsonb_build_object('id','town','title','Change town'));st:=st||'{"step":"shops"}';
  end if;
 elsif action like 'products:%' and answer is null then
  page:=greatest(0,least(1000,coalesce(nullif(substring(action from 10),''),'0')::int));
  for r in select id,name,price,stock from public.shop_products where shop_id=(st->>'shop_id')::uuid and status='active' and is_available is not false and stock>0 order by name,id offset page limit 7 loop
   choices:=choices||jsonb_build_array(jsonb_build_object('id','product:'||r.id,'title',r.name,'description','$'||to_char(r.price,'FM999999990.00')||' · '||r.stock||' available'));
  end loop;
  answer:=coalesce(st->>'shop_name','Products')||E'\nChoose a product. Prices and stock are checked again before confirmation.';
  if jsonb_array_length(choices)=7 then choices:=choices||jsonb_build_array(jsonb_build_object('id','products:'||(page+7),'title','More products'));end if;
  choices:=choices||jsonb_build_array(jsonb_build_object('id','cart','title','View basket'),jsonb_build_object('id','shops','title','Choose another shop'));st:=st||'{"step":"products"}';
 elsif action='cart' and answer is null then
  answer:='Your basket at '||coalesce(st->>'shop_name','the shop')||E':\n';
  for r in select catalog_product.name,catalog_product.price,(c.value->>'qty')::int as qty from jsonb_array_elements(coalesce(st->'cart','[]'))c join public.shop_products catalog_product on catalog_product.id=(c.value->>'id')::uuid loop answer:=answer||r.qty||' × '||left(r.name,60)||' — $'||to_char(r.price*r.qty,'FM999999990.00')||E'\n';end loop;
  choices:=jsonb_build_array(jsonb_build_object('id','products:0','title','Add / change items'),jsonb_build_object('id','checkout','title','Checkout'),jsonb_build_object('id','clear','title','Clear basket'));st:=st||'{"step":"cart"}';
 elsif action='payment_menu' then
  select * into s from public.shops where id=(st->>'shop_id')::uuid;
  foreach policy in array array['pay_on_delivery','ecocash','paynow'] loop
   if public.validate_shop_payment(s.id,policy) and (policy<>'ecocash' or nullif(trim(s.ecocash_number),'') is not null) then choices:=choices||jsonb_build_array(jsonb_build_object('id','payment:'||policy,'title',case policy when 'pay_on_delivery' then 'Pay on delivery' when 'ecocash' then 'EcoCash' else 'Paynow secure link' end));end if;
  end loop;
  answer:='Choose a payment method offered by this shop. Online payments use a secure payment page; never send a PIN in WhatsApp.';st:=st||'{"step":"payment"}';
 elsif action='review' then
  begin
   update public.whatsapp_bot_sessions set state=st where wa_id=p_wa_id;
   review:=public.whatsapp_bot_review(p_wa_id);
   if st->>'terms_agreed' is distinct from review->>'terms_version' then
    st:=st||jsonb_build_object('step','terms','terms_offered',review->>'terms_version');answer:='Read UniLink Terms and Privacy Policy (version '||(review->>'terms_version')||'): https://yysnoiamfoveltvyjzgx.supabase.co/functions/v1/whatsapp-order-bot?legal=1'||E'\nSelect I agree to continue. This is transactional messaging; it does not subscribe you to marketing.';choices:=jsonb_build_array(jsonb_build_object('id','agree','title','I agree'),jsonb_build_object('id','cancel','title','Cancel'));
   else
    st:=st||jsonb_build_object('step','review','review',review,'checkout_id',gen_random_uuid());
    answer:=coalesce(answer||E'\n','')||'Review your order from '||left(review->>'shop_name',80)||E':\n';
    for line in select value from jsonb_array_elements(review->'products') loop answer:=answer||(line->>'qty')||' × '||left(line->>'name',60)||' — $'||to_char((line->>'price')::numeric*(line->>'qty')::int,'FM999999990.00')||E'\n';end loop;
    answer:=answer||'Items: $'||to_char((review->>'subtotal')::numeric,'FM999999990.00')||E'\nDelivery: $'||to_char((review->>'delivery_fee')::numeric,'FM999999990.00')||E'\nEcoCash fee: $'||to_char((review->>'ecocash_fee')::numeric,'FM999999990.00')||E'\nTotal: $'||to_char((review->>'total')::numeric,'FM999999990.00')||E'\nPayment: '||(review->>'payment')||E'\nDeliver to: '||(st->>'address')||E'\nGPS: '||(st->>'latitude')||', '||(st->>'longitude')||E'\nSelect Confirm order to place it.';
    choices:=jsonb_build_array(jsonb_build_object('id','confirm','title','Confirm order'),jsonb_build_object('id','cart','title','Edit basket'),jsonb_build_object('id','cancel','title','Cancel'));
   end if;
  exception when others then answer:=sqlerrm;choices:=jsonb_build_array(jsonb_build_object('id','cart','title','Review basket'),jsonb_build_object('id','support','title','Support'));end;
 end if;
 if menu then choices:=jsonb_build_array(jsonb_build_object('id','shops','title','Shop now'),jsonb_build_object('id','orders','title','My orders'),jsonb_build_object('id','support','title','Support'));st:=st||'{"step":"menu"}';end if;
 if answer is null then answer:='Choose an option below, or reply MENU to start again.';choices:=jsonb_build_array(jsonb_build_object('id','shops','title','Shop now'),jsonb_build_object('id','cart','title','My basket'),jsonb_build_object('id','support','title','Support'));end if;
 st:=st||jsonb_build_object('choices',choices);
 update public.whatsapp_bot_sessions set state=st,updated_at=now(),last_message_at=p_timestamp where wa_id=p_wa_id;
 reply:=coalesce(reply,'{}')||jsonb_build_object('text',answer,'choices',choices);
 insert into public.whatsapp_bot_inbox(message_id,wa_id,kind,response) values(p_message_id,p_wa_id,p_kind,reply);
 insert into public.whatsapp_bot_outbox(message_id,wa_id,payload,expires_at) values(p_message_id,p_wa_id,reply,p_timestamp+interval '23 hours');
 insert into public.business_activity_events(entity_table,entity_id,operation,changed_fields,snapshot) values('whatsapp_bot_messages',p_message_id,'insert',array['message_received'],jsonb_build_object('channel','WhatsApp','kind',p_kind,'sender_last_four',right(p_wa_id,4))) returning id into event_id;
 insert into public.business_activity_email_deliveries(event_id,recipient_email,recipient_role) values(event_id,'unilinkbase@gmail.com','unilink');
 return reply;
end $bot$;
revoke all on function public.whatsapp_bot_message(text,text,text,text,numeric,numeric,text,timestamptz) from public,anon,authenticated;
grant execute on function public.whatsapp_bot_message(text,text,text,text,numeric,numeric,text,timestamptz) to service_role;

create function public.whatsapp_bot_claim_outbox() returns setof public.whatsapp_bot_outbox language plpgsql security invoker set search_path='' as $claim$
begin
 update public.whatsapp_bot_outbox set status='expired',last_error='Customer service window closed.' where status='queued' and expires_at<=now();
 -- A lost HTTP response may already have delivered. Never automatically resend an uncertain message.
 update public.whatsapp_bot_outbox set status='uncertain',last_error='Send outcome unknown; review Meta delivery status.' where status='sending' and next_attempt_at<now();
 return query with selected as(select id from public.whatsapp_bot_outbox where status='queued' and next_attempt_at<=now() and expires_at>now() and attempts<5 and not exists(select 1 from public.whatsapp_bot_outbox busy where busy.wa_id=public.whatsapp_bot_outbox.wa_id and busy.status='sending') order by created_at for update skip locked limit 5)
 update public.whatsapp_bot_outbox o set status='sending',attempts=attempts+1,next_attempt_at=now()+interval '3 minutes' from selected s where o.id=s.id returning o.*;
end $claim$;
revoke all on function public.whatsapp_bot_claim_outbox() from public,anon,authenticated;
grant execute on function public.whatsapp_bot_claim_outbox() to service_role;

create function public.whatsapp_bot_admin(p_username text,p_password text,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $admin$
begin
 if not exists(select 1 from public.verify_admin_login(p_username,p_password)) then raise exception 'Admin credentials required.';end if;
 if p_action='enable' then update public.whatsapp_bot_config set enabled=coalesce((p_data->>'enabled')::boolean,false) where id;
 elsif p_action='link' then
  if not exists(select 1 from public.whatsapp_bot_sessions where wa_id=p_data->>'wa_id' and state->>'step'='account_link') then raise exception 'Choose a WhatsApp account awaiting verification.';end if;
  if not exists(select 1 from public.customers where id=(p_data->>'customer_id')::uuid) then raise exception 'Customer not found.';end if;
  insert into public.whatsapp_bot_customers(wa_id,customer_id) values(p_data->>'wa_id',(p_data->>'customer_id')::uuid) on conflict(wa_id) do nothing;
 elsif p_action<>'list' then raise exception 'Unsupported action.';end if;
 return jsonb_build_object('enabled',(select enabled from public.whatsapp_bot_config where id),'sessions',(select coalesce(jsonb_agg(x),'[]') from(select wa_id,state->>'step' as step,state->>'town' as town,updated_at from public.whatsapp_bot_sessions order by updated_at desc limit 50)x),'outbox',(select coalesce(jsonb_agg(x),'[]') from(select status,count(*) as count from public.whatsapp_bot_outbox group by status)x));
end $admin$;
revoke all on function public.whatsapp_bot_admin(text,text,text,jsonb) from public;
grant execute on function public.whatsapp_bot_admin(text,text,text,jsonb) to anon,authenticated;

select cron.schedule('unilink-whatsapp-bot-outbox','* * * * *',$job$
 select net.http_post(url:='https://yysnoiamfoveltvyjzgx.supabase.co/functions/v1/whatsapp-order-bot',headers:=jsonb_build_object('Content-Type','application/json','x-whatsapp-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='unilink_whatsapp_worker_token')),body:='{}'::jsonb,timeout_milliseconds:=120000);
$job$);
