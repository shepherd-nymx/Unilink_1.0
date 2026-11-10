-- Additive driver identity onboarding; existing admin approval/monthly keys are preserved.
alter table public.drivers add column if not exists auth_id uuid references auth.users(id) on delete set null;
create unique index if not exists drivers_auth_id_unique on public.drivers(auth_id) where auth_id is not null;
create function public.driver_identity_profile() returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; d public.drivers;
begin
 select * into u from auth.users where id=auth.uid();
 if u.id is null or u.email_confirmed_at is null or not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) m where m->>'method' in ('oauth','otp','magiclink')) then raise exception 'Sign in with Google or an email sign-in link first.'; end if;
 select * into d from public.drivers where auth_id=u.id;
 if d.id is null then return null; end if;
 return jsonb_build_object('id',d.id,'full_name',d.full_name,'email',d.email,'approval_status',d.approval_status);
end $$;
revoke all on function public.driver_identity_profile() from public,anon;
grant execute on function public.driver_identity_profile() to authenticated;

create function public.complete_driver_identity_profile(p_full_name text,p_phone text,p_address text,p_national_id text,p_photo_path text,p_university_id uuid,p_custom_location text,p_delivery_type text,p_vehicle_type text,p_vehicle_registration text,p_terms_version text,p_accept_terms boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; d public.drivers; existing jsonb; location_id uuid;
begin
 existing:=public.driver_identity_profile();
 select * into u from auth.users where id=auth.uid();
 perform pg_advisory_xact_lock(hashtextextended('driver-auth:'||u.id::text,0));
 existing:=public.driver_identity_profile();
 if existing is not null then return existing; end if;
 if length(trim(coalesce(p_full_name,''))) not between 2 and 150 or length(trim(coalesce(p_phone,''))) not between 5 and 30 or length(trim(coalesce(p_address,''))) not between 3 and 500 or length(trim(coalesce(p_national_id,''))) not between 3 and 80 then raise exception 'Complete your name, phone, address and national ID.'; end if;
 if p_accept_terms is distinct from true or not exists(select 1 from public.terms_and_conditions where version=p_terms_version and is_active=true) then raise exception 'Review and accept the current terms.'; end if;
 if p_delivery_type is null or p_delivery_type not in ('walking','vehicle') or (p_delivery_type='vehicle' and length(trim(coalesce(p_vehicle_type,''))) not between 2 and 100) then raise exception 'Select a delivery type and provide vehicle details when needed.'; end if;
 if length(coalesce(p_vehicle_registration,''))>100 then raise exception 'Vehicle registration is too long.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('driver-email:'||lower(trim(u.email)),0));
 if exists(select 1 from public.drivers where lower(trim(email))=lower(trim(u.email)) or phone_number=trim(p_phone)) then raise exception 'An application already uses this email or phone. Use driver login or contact support.'; end if;
 if p_photo_path is null or p_photo_path !~ ('^'||u.id::text||'/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif|bmp|heic|heif|avif|tiff|tif)$') or not exists(select 1 from storage.objects where bucket_id='driver-id-cards' and name=p_photo_path and owner_id=u.id::text and coalesce(metadata->>'mimetype','') like 'image/%' and (metadata->>'size')::numeric between 1 and 5242880) then raise exception 'Upload your own national ID photo before applying.'; end if;
 if p_university_id is not null then
  select id into location_id from public.universities where id=p_university_id and is_active=true;
  if location_id is null then raise exception 'Select an active service location.'; end if;
 else
  if length(trim(coalesce(p_custom_location,''))) not between 2 and 150 then raise exception 'Enter your service location.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('driver-location:'||lower(trim(p_custom_location)),0));
  select id into location_id from public.universities where lower(trim(name))=lower(trim(p_custom_location)) and is_active=true limit 1;
  if location_id is null then insert into public.universities(name,is_active) values(trim(p_custom_location),true) returning id into location_id; end if;
 end if;
 insert into public.drivers(auth_id,full_name,phone_number,email,address,national_id,national_id_photo_url,university_id,delivery_type,vehicle_type,vehicle_registration,approval_status,is_available,current_key,key_expires_at,max_distance_km,fee_under_10,fee_10_to_30,fee_30_to_50,terms_accepted,terms_version,terms_accepted_at)
 values(u.id,trim(p_full_name),trim(p_phone),lower(trim(u.email)),trim(p_address),trim(p_national_id),'https://yysnoiamfoveltvyjzgx.supabase.co/storage/v1/object/public/driver-id-cards/'||p_photo_path,location_id,array[p_delivery_type],case when p_delivery_type='vehicle' then trim(p_vehicle_type) else null end,case when p_delivery_type='vehicle' then nullif(trim(p_vehicle_registration),'') else null end,'pending',false,null,null,10,2,5,8,true,p_terms_version,now()) returning * into d;
 insert into public.terms_acceptance_log(user_id,user_type,terms_version) values(u.id,'driver',p_terms_version);
 return public.driver_identity_profile();
end $$;
revoke all on function public.complete_driver_identity_profile(text,text,text,text,text,uuid,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.complete_driver_identity_profile(text,text,text,text,text,uuid,text,text,text,text,text,boolean) to authenticated;
