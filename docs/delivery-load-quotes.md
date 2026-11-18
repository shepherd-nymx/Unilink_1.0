# Load-aware delivery quotes

## Activation status

This is additive and INACTIVE by default. Existing shop fees and order handling continue while `delivery_pricing_settings.enabled=false`. Shops can populate load metadata before activation. No existing weights, capacities or monetary rates are invented. An administrator must approve real transport limits, messenger identities/capacities and rate cards before switching customer checkout to quotes. The admin screen supports manually assessed quotes even where product measurements are incomplete.

Open Admin → Delivery pricing & quote requests. Financial changes require re-entering the existing administrator credentials. Passwords are kept only in screen memory, not local/session storage. Sign out/leave the page when finished.

## Shop product fields

Weight in kg and packed volume in litres are PER UNIT SOLD, plus package size (compact/bag/bulky), fragile handling and two-person-lift flags. Volume can be calculated as packed length × width × height in centimetres / 1000. Blank data stays unknown. Quantity multiplies weight/volume; unknown data forces manual assessment instead of assuming zero load.

## Quote flow

1. Customer confirms delivery GPS and requests one quote per shop/basket. Product prices, quantities and load details are read from the database; caller-supplied prices/weights are ignored. Duplicate active requests with identical snapshots reuse the same quote.
2. Admin checks the actual road route, selects a messenger with an explicitly approved transport/capacity, enters road kilometres, route evidence and an explained fee. A configured rate card suggests base + per-km × road kilometres only for a complete load within its limits. Handling/bulky adjustments require an explicit explanation; they are not invented automatically.
3. Only the assigned, available, approved, in-capacity messenger can see and accept/decline the proposal. They must use verified Supabase sign-in.
4. Customer sees distance, transport, fee, explanation and expiry, then accepts/declines. There is no purchase/payment until each shop has an accepted quote. Quotes expire after 24 hours and can be cancelled before consumption.
5. Checkout is a server-side transaction across all selected shops. It revalidates availability, payment method, stock, product prices/load details, blacklist and messenger capacity, then stores the accepted delivery snapshot with the order. A later shop failure rolls back the entire batch. One quote can create one order only.
6. Both shop and messenger views display the locked terms. Fee, products, total, location and messenger changes are blocked on quoted orders. Existing cancellation status rules remain; this change introduces no cancellation charge. Changes to the load/price require a new quote before purchase/collection.

Shops in one basket remain separate deliveries; no shared-trip discount or full-per-product distance charge is fabricated. Existing EcoCash charges are per shop and captured/revalidated. Existing Paynow checkout uses the returned server order totals for quoted purchases.

## Identity isolation

The legacy customer/driver profile tables have permissive policies, so their editable `auth_id` fields are NOT used as ongoing authority for quotes. A non-exposed `delivery_private.identities` registry imports established verified identities once. New identities require explicit administrator approval after verifying the person, email and Auth user ID. The public helper only returns the signed-in caller’s own mapping. The new quote table has own-customer read RLS; financial writes go through checked RPCs. No anonymous quote/rate/capacity writes are granted.

## Road-distance provider: pending approval

The optional road-lookup source is held in `docs/pending-integrations/delivery-road-distance.ts.example`, outside the deployable function directory. It is NOT deployed. Automatic approval review rejected deployment because it would send customer and shop GPS coordinates to Google without explicit provider/egress approval. Manual route verification remains usable. No Google key has been provisioned and no Google routing charge was activated.

After the user approves this provider, configure server-only `GOOGLE_ROUTES_API_KEY`, deploy the function with its explicit administrator credential checks, set `EXPO_PUBLIC_DELIVERY_ROUTING_ENABLED=true` and rebuild. The endpoint derives shop/destination coordinates from saved records rather than trusting client coordinates. It requests road distances via Google Routes for walking/bicycle/driving; van/truck routes require manual vehicle-appropriate verification. The app never substitutes straight-line distance for a road route. Billing limits and suitability should be settled before activation.

## Validation

- `npm run typecheck`, `npm run build:web`
- `node scripts/test-delivery-load.cjs`
- A Chromium browser check against the production web export with mocked APIs covered pending-price checkout blocking, GPS confirmation, quote refresh/acceptance, a single batch order submission, administrator credentials staying out of storage, and shop decimal weight/volume entry. No payment, order, notification or Google request was sent by that browser test.
- `scripts/test-delivery-quotes.sql` must be wrapped in BEGIN/ROLLBACK; it creates temporary administrative/messenger fixtures and an order. Never commit that test transaction. It tests quantity totals, private identity ownership despite public-profile tampering, admin credential rejection, messenger impersonation/capacity rejection, both-party acceptance, stale metadata rejection, atomic multi-shop rollback, fee locks and duplicate purchase rejection.
- The schema and integration assertions were exercised against the hosted database inside rolled-back transactions before applying the additive migration. No real order, payment or notification was committed during testing.

Older clients cannot insert unquoted new shop orders once quote checkout is activated; existing historical orders retain their existing behavior. Keep quote checkout inactive until the verified-account and admin-review operating process is ready.
