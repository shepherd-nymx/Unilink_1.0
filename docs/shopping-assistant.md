# UNILINK shopping assistant

Entry points: Home → Shop with UNILINK, or Nearby shops → Ask UNILINK. The customer navigation remains visible. The first version recommends products/baskets and opens an exact product in its existing shop catalogue. It does not modify carts, place orders, make payments, cancel orders, send messages or access private order/account data. Customers add their chosen packs and review checkout themselves.

## Runtime

`POST /api/shopping-assistant` is a Vercel Node function, separate from the static Expo app. It uses existing public Supabase URL/anon-key variables. It reads active shops, service locations, active in-stock products, shop delivery tiers and the selected university name. No service-role key, schema change or new database permission is needed. The supplied university ID is a public service-area selector, not proof of customer identity. The API does not accept customer IDs or fetch customers/orders/payments.

`ai@7.0.166` parses the last five conversation messages into a validated intent: products, amounts/units, USD budget and whether delivery is included. Only conversation text is sent to the model; the app's customer records, shop catalogue, address, phone, coordinates and identifiers are not sent. The UI warns users not to put private information in their request. Free model providers may retain/use submitted text; do not present this as a private support channel.

The model is pinned to `reflection/beam-free`, confirmed in the live Gateway catalogue on 2026-11-09 with zero input/output token prices and structured-output support. Before use, the server checks that exact model still has zero token prices; metadata is cached for five minutes. There is no configured paid model fallback, API-key creation, paid integration or automatic top-up. Authentication uses Vercel deployment OIDC (or an existing server-only AI_GATEWAY_API_KEY). Free model access can still require account verification, credits eligibility or have rate limits; pricing/access is controlled by the provider. If the model stops being free or is unavailable, AI parsing stops and the response is clearly marked Basic catalogue search. The basic parser supports simple explicit numeric shopping lists without conversational inference.

## Deterministic catalogue tools

The server, rather than AI text, controls all product IDs, names, prices, stock, availability and calculations. Pack sizes are derived only from a single unambiguous measure in the saved product name; kg/g and L/ml conversions and multiplication packs are supported. Unknown sizes remain browse-only options when a measured amount was requested. Closed/unavailable shops can appear as browse-only matches but cannot supply a suggested basket. Opening hours are evaluated in Africa/Harare. Stock limits include repeated requests for the same product.

The assistant sums existing per-shop delivery tiers/fees using the same tier helper as checkout. It does not implement the earlier illustrative distance/value formula. Unknown fallback delivery fees are not guessed. The budget defaults to including delivery; customers can explicitly request a goods-only budget. Payment-dependent charges are excluded and disclosed. Quotes are estimates: existing checkout must validate actual availability, payment costs and delivery.

Suggestions consider up to 12 matching purchasable options per requested item, with a bounded 128-candidate beam. They are suggested baskets, not a guarantee of the globally cheapest basket. Matching is keyword-based after intent interpretation, with common staple/appliance/cosmetic mismatches excluded. Customers must verify product suitability. Search caps and potentially truncated public catalogue reads are disclosed. Currency conversion, dietary guarantees and substitute approvals are not supported.

## Limits and operation

Requests are limited to 8KB, six messages, 1,000 characters per message, 4,000 total characters and six requested products. Calls have bounded output, no SDK retries and an 18-second inference timeout. There is a best-effort eight-per-minute hashed-IP throttle per server instance. It is not a distributed abuse limit or global spend cap. Keep the model zero-price-only; add a durable limiter and explicit approved spend controls before enabling paid inference or broader automation.

No conversations are saved to the database/local storage. They remain in the current screen's memory. Function logs contain only failure category/status, never prompts or raw upstream responses. Existing Vercel/platform request logging still applies.

## Validation

- `node scripts/test-shopping-assistant.cjs`: units, pack sizes, combined stock, closed/other-area shops, wrong product-type exclusions, known and unknown delivery fees, price tiers, multi-shop totals, under/over budget, unsupported currencies, Harare opening times, basic parser, request validation, no-store responses and throttle.
- `npm run typecheck` and `EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 npm run build:web`.
- Browser integration: Home → assistant → real Node handler with mocked model/catalogue → basket → matching product → existing cart. Dark 390px, light 320px and dark desktop 1440px; persistent navigation and no horizontal overflow.
- Actual public Supabase catalogue loader checked read-only against UniLink: four active shops, 106 in-stock products and seven service-area rows at verification time. No customer records were created or production orders sent.

If free AI access needs setup, use the owning Vercel team's AI Gateway dashboard; do not paste credentials in chat or enable a paid top-up without authorization. The catalogue fallback remains usable while setup is pending.
