-- Alert on other business changes using field names only; excluded data values stay private.
create or replace function public.capture_business_activity_email() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare current_row jsonb; previous_row jsonb; safe_row jsonb; previous_safe jsonb; allowed text[]; changed text[];
 event_id uuid; shop_id uuid; driver_id uuid; previous_driver uuid; recipient text; conversation jsonb; other_changes text[];
begin
 current_row:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 previous_row:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 allowed:=case tg_table_name
 when 'customers' then array['id','full_name','email','phone_number','phone_verified','university_id','terms_accepted','terms_version']
 when 'drivers' then array['id','full_name','email','notification_email','phone_number','approval_status','is_available','suspended','subscription_status','subscription_expiry','vehicle_type','delivery_type','payment_methods','max_distance_km','availability_start_time','availability_end_time','availability_days','active_university_id']
 when 'shops' then array['id','name','contact_email','contact_phone','status','address','category','description','is_available','operating_hours','accepted_payment_methods','delivery_fee','ecocash_fee','commission_paid','commission_percentage','driver_assignment_mode','offers_free_delivery']
 when 'shop_products' then array['id','shop_id','name','price','stock','category','status','is_available','description','weight_kg','volume_litres','package_size','fragile','two_person_lift']
 when 'shop_orders' then array['id','shop_id','customer_id','customer_name','status','messenger_id','total_amount','delivery_fee','payment_method','goods_received_at','delivery_quote_id']
 when 'deliveries' then array['id','customer_id','driver_id','status','total_amount','delivery_fee','payment_option','payment_received','delivery_mode','scheduled_for','preferred_delivery_method','declined_at','picked_up_at','cancelled_at']
 when 'delivery_requests' then array['id','customer_id','driver_id','status','service_type','payment_method','delivery_method','delivery_fee','offer_fee','delivery_mode']
 when 'delivery_quotes' then array['id','shop_id','customer_id','driver_id','status','subtotal','weight_kg','volume_litres','fragile','two_person_lift','transport','road_km','delivery_fee','explanation']
 when 'chat_messages' then array['id','conversation_id','sender_type','sender_id']
 when 'delivery_rate_cards' then array['transport','base_fee','per_km','max_weight_kg','max_volume_litres','enabled']
 when 'driver_delivery_capacity' then array['driver_id','transport','max_weight_kg','max_volume_litres','two_person_lift']
 when 'delivery_pricing_settings' then array['id','enabled']
 else array[]::text[] end;
 select coalesce(jsonb_object_agg(key,value),'{}') into safe_row from jsonb_each(current_row) where key=any(allowed);
 select coalesce(jsonb_object_agg(key,value),'{}') into previous_safe from jsonb_each(previous_row) where key=any(allowed);
 if tg_op='UPDATE' and tg_table_name='chat_messages' then return new; end if; -- read receipts are not new activity
 if tg_op='UPDATE' and current_row->'password_hash' is distinct from previous_row->'password_hash' then
  safe_row:=safe_row||'{"credentials_changed":true}'::jsonb;
 end if;
 if tg_op='UPDATE' then
  -- Record other business field names without serializing their values (images,
  -- delivery item edits, availability/rate fields, location or verification changes).
  select coalesce(array_agg(key order by key),'{}') into other_changes from jsonb_each(current_row)
  where value is distinct from previous_row->key and not key=any(allowed||array['created_at','updated_at','location_timestamp','location_accuracy','delivered_snapshot','delivered_snapshot_expires_at']);
  if cardinality(other_changes)>0 then safe_row:=safe_row||jsonb_build_object('other_fields_changed',other_changes); end if;
 end if;
 if tg_op='UPDATE' and safe_row=previous_safe then return new; end if;
 select coalesce(array_agg(key order by key),'{}') into changed from jsonb_each(safe_row) where tg_op<>'UPDATE' or value is distinct from previous_safe->key;
 insert into public.business_activity_events(entity_table,entity_id,operation,changed_fields,snapshot)
 values(tg_table_name,coalesce(current_row->>'id',current_row->>'driver_id',current_row->>'transport'),lower(tg_op),changed,safe_row) returning id into event_id;
 -- UniLink is always a separate recipient, even when no shop/driver email exists.
 insert into public.business_activity_email_deliveries(event_id,recipient_email,recipient_role) values(event_id,'unilinkbase@gmail.com','unilink');
 shop_id:=nullif(current_row->>'shop_id','')::uuid;
 driver_id:=coalesce(nullif(current_row->>'driver_id',''),nullif(current_row->>'messenger_id',''))::uuid;
 if tg_table_name='shops' then shop_id:=(current_row->>'id')::uuid; end if;
 if tg_table_name='drivers' then driver_id:=(current_row->>'id')::uuid; end if;
 if tg_table_name='chat_messages' then
  select to_jsonb(c) into conversation from public.chat_conversations c where c.id=(current_row->>'conversation_id')::uuid;
  shop_id:=(conversation->>'shop_id')::uuid;driver_id:=(conversation->>'driver_id')::uuid;
 end if;
 if tg_op='UPDATE' then previous_driver:=coalesce(nullif(previous_row->>'driver_id',''),nullif(previous_row->>'messenger_id',''))::uuid; end if;
 if shop_id is not null then
  select lower(trim(contact_email)) into recipient from public.shops where id=shop_id;
  if recipient is null and tg_table_name='shops' then recipient:=lower(trim(current_row->>'contact_email'));end if;
  if recipient ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
   insert into public.business_activity_email_deliveries(event_id,recipient_email,recipient_role) values(event_id,recipient,'shop') on conflict do nothing;
  end if;
 end if;
 if tg_table_name='drivers' and tg_op='DELETE' then
  recipient:=lower(trim(coalesce(nullif(current_row->>'notification_email',''),current_row->>'email')));
  if recipient ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
   insert into public.business_activity_email_deliveries(event_id,recipient_email,recipient_role) values(event_id,recipient,'driver') on conflict do nothing;
  end if;
 end if;
 for recipient in select distinct lower(trim(coalesce(nullif(notification_email,''),email))) from public.drivers where id in(driver_id,previous_driver) loop
  if recipient ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
   insert into public.business_activity_email_deliveries(event_id,recipient_email,recipient_role) values(event_id,recipient,'driver') on conflict do nothing;
  end if;
 end loop;
 return case when tg_op='DELETE' then old else new end;
end $fn$;
