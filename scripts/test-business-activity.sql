-- Wrap this entire script in BEGIN/ROLLBACK. Never commit fixtures.
do $test$
declare customer_row public.customers; product_row public.shop_products; event_row public.business_activity_events; n bigint; shop_email text; secret_fixture text:='must-never-appear-in-an-email';
begin
 insert into public.customers(username,full_name,phone_number,email,password_hash,latitude,longitude) values('activity_test_'||gen_random_uuid()::text,'Rollback activity customer','test-'||gen_random_uuid()::text,'activity-test@example.invalid','initial-test-only',0,0) returning * into customer_row;
 select * into product_row from public.shop_products limit 1;
 if customer_row.id is null or product_row.id is null then raise exception 'Test fixtures unavailable';end if;
 if has_table_privilege('anon','public.business_activity_events','SELECT') or has_table_privilege('authenticated','public.business_activity_email_deliveries','UPDATE') then raise exception 'Private queue is exposed';end if;
 select count(*) into n from public.business_activity_events;
 update public.customers set full_name=full_name where id=customer_row.id;
 if (select count(*) from public.business_activity_events)<>n then raise exception 'Unchanged account generated mail';end if;
 update public.customers set password_hash=secret_fixture where id=customer_row.id;
 select * into event_row from public.business_activity_events where entity_id=customer_row.id::text order by created_at desc,id desc limit 1;
 if event_row.snapshot::text like '%'||secret_fixture||'%' or event_row.snapshot ? 'password_hash' or not (event_row.snapshot->>'credentials_changed')::boolean then raise exception 'Credentials were leaked or change not recorded';end if;
 if not exists(select 1 from public.business_activity_email_deliveries where event_id=event_row.id and recipient_email='unilinkbase@gmail.com') then raise exception 'UniLink recipient missing';end if;
 insert into public.shop_products(shop_id,name,price,stock,status) values(product_row.shop_id,'Rollback activity test',1,1,'active') returning * into product_row;
 select * into event_row from public.business_activity_events where entity_id=product_row.id::text limit 1;
 if event_row.operation<>'insert' then raise exception 'New product not captured';end if;
 select lower(trim(contact_email)) into shop_email from public.shops where id=product_row.shop_id;
 if shop_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and not exists(select 1 from public.business_activity_email_deliveries where event_id=event_row.id and recipient_email=shop_email) then raise exception 'Relevant shop recipient missing';end if;
 select count(*) into n from public.business_activity_events;
 update public.shop_products set updated_at=now() where id=product_row.id;
 if (select count(*) from public.business_activity_events)<>n then raise exception 'Timestamp-only update generated mail';end if;
 delete from public.shop_products where id=product_row.id;
 if not exists(select 1 from public.business_activity_events where entity_id=product_row.id::text and operation='delete') then raise exception 'Product deletion not captured';end if;
 if exists(select 1 from public.business_activity_events e where not exists(select 1 from public.business_activity_email_deliveries d where d.event_id=e.id and d.recipient_email='unilinkbase@gmail.com')) then raise exception 'An activity lacks the mandatory UniLink recipient';end if;
end $test$;
