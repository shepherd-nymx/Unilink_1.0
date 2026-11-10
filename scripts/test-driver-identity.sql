-- Run in an isolated/transactional test session. Everything is rolled back.
begin;
do $$
declare
 uid uuid := gen_random_uuid(); uid2 uuid := gen_random_uuid(); loc uuid; ver text; path text; result jsonb; again jsonb; denied boolean;
begin
 select id into loc from public.universities where is_active=true limit 1;
 select version into ver from public.terms_and_conditions where is_active=true limit 1;
 if loc is null or ver is null then raise exception 'Test needs active location and terms'; end if;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values(uid,uid::text||'@example.test',now(),'{}','{}'),(uid2,uid2::text||'@example.test',now(),'{}','{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','oauth')))::text,true);
 if public.driver_identity_profile() is not null then raise exception 'Unexpected existing profile'; end if;
 path:=uid::text||'/test-id.jpg';
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('driver-id-cards',path,uid::text,'{"mimetype":"image/jpeg","size":100}');
 denied:=false;begin perform public.complete_driver_identity_profile('Test Driver','+263-test-'||left(uid::text,12),'Test address','TEST-ID',path,loc,null,'walking',null,null,ver,false);exception when others then denied:=true;end;
 if not denied then raise exception 'Terms refusal accepted'; end if;
 denied:=false;begin perform public.complete_driver_identity_profile('Test Driver','+263-test-'||left(uid::text,12),'Test address','TEST-ID',uid2::text||'/other.jpg',loc,null,'walking',null,null,ver,true);exception when others then denied:=true;end;
 if not denied then raise exception 'Other user photo accepted'; end if;
 -- Phone must satisfy the actual production length constraint enforced by the RPC.
 result:=public.complete_driver_identity_profile('Test Driver','+263-test-'||left(uid::text,12),'Test address','TEST-ID',path,loc,null,'walking',null,null,ver,true);
 if result->>'approval_status'<>'pending' then raise exception 'Application bypassed approval'; end if;
 if exists(select 1 from public.drivers where id=(result->>'id')::uuid and (current_key is not null or key_expires_at is not null or is_available is distinct from false)) then raise exception 'Pending driver got access credentials'; end if;
 if result ? 'current_key' then raise exception 'RPC exposed monthly key'; end if;
 again:=public.complete_driver_identity_profile('Changed Name','+263-unused','Test address','TEST-ID',path,loc,null,'walking',null,null,ver,true);
 if again->>'id'<>result->>'id' then raise exception 'Retry created duplicate'; end if;
 if not exists(select 1 from public.terms_acceptance_log where user_id=uid and user_type='driver' and terms_version=ver) then raise exception 'Consent not recorded'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid2,'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','oauth')))::text,true);
 if public.driver_identity_profile() is not null then raise exception 'Another user saw application'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','password')))::text,true);
 denied:=false;begin perform public.driver_identity_profile();exception when others then denied:=true;end;
 if not denied then raise exception 'Autoconfirmed password identity accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','otp')))::text,true);
 if public.driver_identity_profile()->>'id'<>result->>'id' then raise exception 'Email-link identity failed'; end if;
 update public.drivers set approval_status='approved' where id=(result->>'id')::uuid;
 if public.driver_identity_profile()->>'approval_status'<>'approved' then raise exception 'Approval status not refreshed'; end if;
end $$;
select 'PASS: verified registration, pending/no-key defaults, owned photo, current terms, idempotency, isolated profiles, OAuth/OTP proof and approval status' as result;
rollback;
