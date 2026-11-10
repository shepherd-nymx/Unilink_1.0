# Google sign-in branding for UNILINK

Use the existing Google Cloud project/OAuth client already connected to Supabase. Updating its client name alone does not change the consent screen. Open https://console.cloud.google.com/auth/branding and select that project.

Set:
- App name: UNILINK
- App logo: https://www.unilinkbase.com/icon-512.png (download and upload the existing PNG)
- User support email: unilinkbase@gmail.com (select the appropriate existing support address if Google restricts available addresses)
- Application home page: https://www.unilinkbase.com
- Privacy-policy URL: https://www.unilinkbase.com/policies?type=privacy
- Authorized domain: unilinkbase.com
- Developer contact email: the owner's monitored address

Save and complete Google's Branding/Verification Center requirements. Google controls approval and propagation; verified branding is needed for the name/logo to replace the generic project-domain presentation. Do not claim this is activated until the owner saves/submits and Google accepts it. Connected tools do not provide Google Auth Platform administration access.

The existing `/policies` screen is public and local content, but direct navigation previously returned 404. A scoped Vercel rewrite now lets Google/users open this existing privacy policy directly. No policy wording, login logic, provider credentials, client IDs or callback behavior is changed.

The provider callback remains https://yysnoiamfoveltvyjzgx.supabase.co/auth/v1/callback. Do not remove or edit it while applying branding. A custom Supabase domain such as auth.unilinkbase.com can also brand the actual authentication host, but requires a paid Supabase plan/add-on and separate DNS/provider callback setup. No paid domain add-on has been enabled. Google branding/verification should be completed first.

References:
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google#setup-consent-screen-branding
- https://supabase.com/docs/guides/platform/custom-domains
