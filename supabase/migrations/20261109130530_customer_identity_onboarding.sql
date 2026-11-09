-- Additive customer identity bridge; existing portal policies and credentials remain unchanged.
-- Definer access is limited to the authenticated caller's verified email/auth identity.
CREATE OR REPLACE FUNCTION public.customer_identity_profile()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u auth.users; c public.customers; n integer;
BEGIN
 SELECT * INTO u FROM auth.users WHERE id=auth.uid();
 IF u.id IS NULL OR u.email_confirmed_at IS NULL THEN RAISE EXCEPTION 'Verify your email before continuing.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u.id::text,0));
 SELECT * INTO c FROM public.customers WHERE auth_id=u.id;
 IF c.id IS NULL THEN
   SELECT count(*) INTO n FROM public.customers WHERE lower(trim(email))=lower(trim(u.email));
   IF n>1 THEN RAISE EXCEPTION 'Multiple customer profiles use this email. Please contact support.'; END IF;
   IF n=1 THEN
     SELECT * INTO c FROM public.customers WHERE lower(trim(email))=lower(trim(u.email)) FOR UPDATE;
     IF c.auth_id IS NOT NULL AND c.auth_id<>u.id THEN RAISE EXCEPTION 'This customer profile is linked to another account. Please contact support.'; END IF;
     UPDATE public.customers SET auth_id=u.id WHERE id=c.id;
   END IF;
 END IF;
 IF c.id IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',c.id,'full_name',c.full_name,'email',c.email);
END $$;
REVOKE ALL ON FUNCTION public.customer_identity_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_identity_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_customer_identity_profile(
 p_full_name text,p_phone text,p_university_id uuid,p_latitude numeric,p_longitude numeric,p_address text,p_accuracy numeric,p_terms_version text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u auth.users; c public.customers; existing jsonb;
BEGIN
 existing:=public.customer_identity_profile();
 IF existing IS NOT NULL THEN RETURN existing; END IF;
 SELECT * INTO u FROM auth.users WHERE id=auth.uid();
 IF length(trim(coalesce(p_full_name,'')))<2 OR length(trim(coalesce(p_phone,'')))<5 THEN RAISE EXCEPTION 'Enter your name and phone number.'; END IF;
 IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 OR coalesce(trim(p_address),'')='' THEN RAISE EXCEPTION 'Capture a valid delivery location.'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.universities WHERE id=p_university_id AND is_active=true) THEN RAISE EXCEPTION 'Select an active delivery location.'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.terms_and_conditions WHERE version=p_terms_version AND is_active=true) THEN RAISE EXCEPTION 'Review and accept the current terms.'; END IF;
 -- Unique internal username satisfies the existing schema without asking OAuth users for credentials.
 INSERT INTO public.customers(full_name,phone_number,email,username,password_hash,auth_id,phone_verified,latitude,longitude,university_id,terms_accepted,terms_version,terms_accepted_at)
 VALUES(trim(p_full_name),trim(p_phone),lower(trim(u.email)),'auth_'||replace(u.id::text,'-',''),NULL,u.id,false,p_latitude,p_longitude,p_university_id,true,p_terms_version,now()) RETURNING * INTO c;
 INSERT INTO public.customer_addresses(customer_id,address_type,latitude,longitude,formatted_address,is_default,accuracy)
 VALUES(c.id,'default',p_latitude,p_longitude,p_address,true,p_accuracy);
 INSERT INTO public.terms_acceptance_log(user_id,user_type,terms_version) VALUES(u.id,'customer',p_terms_version);
 RETURN jsonb_build_object('id',c.id,'full_name',c.full_name,'email',c.email);
END $$;
REVOKE ALL ON FUNCTION public.complete_customer_identity_profile(text,text,uuid,numeric,numeric,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_customer_identity_profile(text,text,uuid,numeric,numeric,text,numeric,text) TO authenticated;
