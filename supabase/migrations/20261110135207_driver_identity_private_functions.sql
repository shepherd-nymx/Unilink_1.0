-- Keep privileged implementation outside exposed schemas; public RPCs are invoker wrappers.
create schema if not exists identity_private;
revoke all on schema identity_private from public;
grant usage on schema identity_private to authenticated;
alter function public.driver_identity_profile() set schema identity_private;
create function public.driver_identity_profile() returns jsonb language sql security invoker set search_path='' as $$select identity_private.driver_identity_profile();$$;
revoke all on function public.driver_identity_profile() from public,anon;
grant execute on function public.driver_identity_profile() to authenticated;
alter function public.complete_driver_identity_profile(text,text,text,text,text,uuid,text,text,text,text,text,boolean) set schema identity_private;
create function public.complete_driver_identity_profile(p_full_name text,p_phone text,p_address text,p_national_id text,p_photo_path text,p_university_id uuid,p_custom_location text,p_delivery_type text,p_vehicle_type text,p_vehicle_registration text,p_terms_version text,p_accept_terms boolean)
returns jsonb language sql security invoker set search_path='' as $$select identity_private.complete_driver_identity_profile($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12);$$;
revoke all on function public.complete_driver_identity_profile(text,text,text,text,text,uuid,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.complete_driver_identity_profile(text,text,text,text,text,uuid,text,text,text,text,text,boolean) to authenticated;
revoke all on function identity_private.driver_identity_profile() from public,anon;
revoke all on function identity_private.complete_driver_identity_profile(text,text,text,text,text,uuid,text,text,text,text,text,boolean) from public,anon;
grant execute on function identity_private.driver_identity_profile() to authenticated;
grant execute on function identity_private.complete_driver_identity_profile(text,text,text,text,text,uuid,text,text,text,text,text,boolean) to authenticated;
