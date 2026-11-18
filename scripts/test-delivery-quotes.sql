-- Rollback-only integration test: wrap in BEGIN/ROLLBACK. Never commit fixtures.
do $test$
declare cid uuid; cuid uuid; duid uuid; sid uuid; pid uuid; did uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid(); q jsonb; result jsonb; oid uuid; rejected boolean;
begin
 select id,auth_id into cid,cuid from public.customers where auth_id is not null limit 1;
 select c.auth_id into duid from public.customers c where c.auth_id is not null and c.auth_id<>cuid and not exists(select 1 from public.drivers d where d.auth_id=c.auth_id) limit 1;
 select p.id,p.shop_id into pid,sid from public.shop_products p join public.shops s on s.id=p.shop_id where p.stock>=2 and p.status='active' and p.is_available is not false and s.status='active' and s.is_available and (public.validate_shop_order(s.id)->>'allowed')::boolean and not exists(select 1 from public.shop_customer_blacklist b where b.shop_id=s.id and b.customer_id=cid) limit 1;
 if cid is null or duid is null or pid is null then raise exception 'Required rollback-test fixture unavailable.'; end if;
 insert into public.admins(id,username,password_hash) values(aid,'delivery_test_'||aid::text,'rollback-test-only');
 insert into public.drivers(id,phone_number,full_name,auth_id,approval_status,is_available,suspended) values(did,'+263000000000','Rollback delivery test',duid,'approved',true,false);
 insert into delivery_private.identities(user_id,driver_id) values(duid,did) on conflict(user_id) do update set driver_id=excluded.driver_id;
 update public.shop_products set weight_kg=2,volume_litres=3,package_size='bag',fragile=false,two_person_lift=false where id=pid;
 -- Editable legacy auth_id fields must not grant access to someone else's quotes.
 if exists(select 1 from delivery_private.identities where customer_id=cid and user_id<>cuid) then raise exception 'Bad identity fixture';end if;
 -- Invalid administrator cannot activate rates.
 rejected:=false;begin perform public.manage_delivery_pricing('invalid','invalid','enable','{"enabled":true}');exception when others then rejected:=true;end;if not rejected then raise exception 'Invalid admin accepted';end if;
 perform public.manage_delivery_pricing('delivery_test_'||aid::text,'rollback-test-only','enable','{"enabled":true}');
 perform public.manage_delivery_pricing('delivery_test_'||aid::text,'rollback-test-only','rates','{"transport":"car","base_fee":1,"per_km":2,"max_weight_kg":20,"max_volume_litres":100,"enabled":true}');
 perform public.manage_delivery_pricing('delivery_test_'||aid::text,'rollback-test-only','capacity',jsonb_build_object('driver_id',did,'transport','car','max_weight_kg',20,'max_volume_litres',100));
 perform set_config('request.jwt.claim.sub',cuid::text,true);
 q:=public.request_delivery_quote(sid,jsonb_build_array(jsonb_build_object('id',pid,'qty',2)),-17.82,31.03);
 if (q->>'weight_kg')::numeric<>4 or (q->>'volume_litres')::numeric<>6 then raise exception 'Quantity aggregation failed';end if;
 -- Tampering with the legacy public auth_id must not transfer quote ownership.
 update public.customers set auth_id=null where auth_id=duid and id<>cid;
 update public.customers set auth_id=duid where id=cid;
 perform set_config('request.jwt.claim.sub',duid::text,true);
 if (public.delivery_quote_identity()->>'customer_id')::uuid=cid then raise exception 'Mutable identity field transferred quote ownership';end if;
 perform set_config('request.jwt.claim.sub',cuid::text,true);
 if (public.delivery_quote_identity()->>'customer_id')::uuid is distinct from cid then raise exception 'Trusted quote identity lost';end if;
 update public.customers set auth_id=cuid where id=cid;
 -- Customer cannot accept an unreviewed quote or self-propose a price.
 rejected:=false;begin perform public.respond_delivery_quote((q->>'id')::uuid,true);exception when others then rejected:=true;end;if not rejected then raise exception 'Unreviewed quote accepted';end if;
 perform public.manage_delivery_pricing('delivery_test_'||aid::text,'rollback-test-only','propose',jsonb_build_object('id',q->>'id','driver_id',did,'road_km',3,'delivery_fee',7,'route_evidence','Synthetic test road route','explanation','Test base 1 plus 3 road km at 2; no handling surcharge.'));
 -- Capacity changes are rechecked before a messenger can accept.
 update public.driver_delivery_capacity set max_weight_kg=1 where driver_id=did;
 perform set_config('request.jwt.claim.sub',duid::text,true);
 if exists(select 1 from public.driver_delivery_quotes() where id=(q->>'id')::uuid) then raise exception 'Overweight proposal visible';end if;
 rejected:=false;begin perform public.respond_delivery_quote((q->>'id')::uuid,true);exception when others then rejected:=true;end;if not rejected then raise exception 'Overweight proposal accepted';end if;
 update public.driver_delivery_capacity set max_weight_kg=20 where driver_id=did;
 perform set_config('request.jwt.claim.sub',cuid::text,true);
 -- Wrong customer identity cannot accept as messenger.
 rejected:=false;begin perform public.respond_delivery_quote((q->>'id')::uuid,true);exception when others then rejected:=true;end;if not rejected then raise exception 'Messenger impersonation accepted';end if;
 perform set_config('request.jwt.claim.sub',duid::text,true);
 if not exists(select 1 from public.driver_delivery_quotes() where id=(q->>'id')::uuid) then raise exception 'Eligible driver cannot view proposal';end if;
 perform public.respond_delivery_quote((q->>'id')::uuid,true);
 perform set_config('request.jwt.claim.sub',cuid::text,true);
 perform public.respond_delivery_quote((q->>'id')::uuid,true);
 -- Price cannot be revised after both parties agree.
 rejected:=false;begin perform public.manage_delivery_pricing('delivery_test_'||aid::text,'rollback-test-only','propose',jsonb_build_object('id',q->>'id'));exception when others then rejected:=true;end;if not rejected then raise exception 'Agreed quote editable';end if;
 -- Stale item measurements cannot silently change the agreed load.
 update public.shop_products set weight_kg=3 where id=pid;
 rejected:=false;begin perform public.place_quoted_shop_orders(array[(q->>'id')::uuid],'pay_on_delivery','Synthetic rollback test address',null);exception when others then rejected:=true;end;if not rejected then raise exception 'Stale load accepted';end if;
 update public.shop_products set weight_kg=2 where id=pid;
 -- The first purchase is rolled back if a later shop quote in the batch is invalid.
 rejected:=false;begin perform public.place_quoted_shop_orders(array[(q->>'id')::uuid,'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid],'pay_on_delivery','Synthetic rollback test address',null);exception when others then rejected:=true;end;if not rejected then raise exception 'Invalid multi-shop checkout accepted';end if;
 if exists(select 1 from public.shop_orders where delivery_quote_id=(q->>'id')::uuid) then raise exception 'Partial multi-shop purchase escaped rollback';end if;
 result:=public.place_quoted_shop_orders(array[(q->>'id')::uuid],'pay_on_delivery','Synthetic rollback test address',null);
 oid:=(result->sid::text->>'id')::uuid;
 if oid is null or (result->sid::text->>'delivery_fee')::numeric<>7 then raise exception 'Quoted checkout failed';end if;
 rejected:=false;begin update public.shop_orders set delivery_fee=0 where id=oid;exception when others then rejected:=true;end;if not rejected then raise exception 'Fee lock bypassed';end if;
 rejected:=false;begin perform public.place_quoted_shop_orders(array[(q->>'id')::uuid],'pay_on_delivery','Synthetic rollback test address',null);exception when others then rejected:=true;end;if not rejected then raise exception 'Duplicate purchase permitted';end if;
 raise notice 'PASS: quantity totals, admin auth, messenger identity, two-party acceptance, order creation, locked fees and duplicate checkout. All changes rolled back.';
end $test$;
