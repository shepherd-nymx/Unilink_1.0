-- Additive customer identity bridge; existing portal policies and credentials remain unchanged.
-- Definer access is limited to the authenticated caller's verified email/auth identity.
CREATE OR REPLACE FUNCTION public.customer_identity_profile()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u auth.users; c public.customers; n integer;
BEGIN
 SELECT * INTO u FROM auth.users WHERE id=auth.uid();
 IF u.id IS NULL OR u.email_confirmed_at IS NULL THEN RAISE EXCEPTION 'Verify your email before continuing.'; END IF;
 -- A confirmed timestamp alone is insufficient when password signup auto-confirm is enabled.
 -- AMR comes from the server-signed JWT, never user-editable metadata.
 IF NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) AS method
   WHERE method->>'method' IN ('oauth','otp','magiclink')
 ) THEN RAISE EXCEPTION 'Sign in with Google or an email sign-in link before continuing.'; END IF;
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

