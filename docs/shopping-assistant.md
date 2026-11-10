# UNILINK shopping assistant

Entry points: Home → Shop with UNILINK, or Nearby shops → Ask UNILINK. Customer navigation stays visible. Recommendations open the exact product in the existing shop catalogue, preserving an existing cart. This version does not place orders, pay, cancel orders, send messages or access private order data. Customers add their chosen packs and review checkout themselves.

## Model and free-credit allowance

The original `reflection/beam-free` model was refused by Gateway: access requires purchased credits, even though its listed token prices are zero. Account/card verification was completed by the owner. The assistant instead uses `amazon/nova-micro` through Vercel Gateway OIDC and the account's existing free-tier credit allowance. No credits are purchased and no automatic top-up or paid subscription is enabled by this code.

Before inference:

1. Verify the exact model exists and its base/regional prices are at most $0.00000005 per input token and $0.0000002 per output token. Metadata is cached for five minutes; a price above these bounds stops AI.
2. Check Gateway reports at least $0.002 of credit balance. Gateway remains responsible for actual balance enforcement; the code does not identify purchased vs free funds or change account billing settings. Keep automatic top-ups disabled in Gateway.
3. Atomically reserve one of 500 requests per UTC calendar month in an isolated Supabase quota. Each reservation conservatively accounts for $0.002, allocating at most $1/month to this assistant at checked model prices. Failed calls also consume a reservation, keeping the cap conservative.

The prompt has a bounded request/history/schema size (<20k input tokens) and output is capped at 1,800 tokens, with zero retries. At the allowed price bounds this is below the per-request reservation. This is an application request cap and conservative cost allocation, not a team-wide Gateway billing cap. It does not control other apps, vendor price changes between checks or later owner changes to billing/routing. No inference is attempted if the allowance guard cannot be checked. Missing/exhausted credits, capped usage or provider failure falls back to clearly labelled basic catalogue search.

`ASSISTANT_BUDGET_TOKEN` is a production-only Vercel Secret. Its SHA-256 digest is stored in `assistant_private.budget_settings`; the token is never stored in source, client bundles, logs or conversations. A private SECURITY DEFINER function authenticates the backend with that token and increments only the bounded monthly request counter. A public SECURITY INVOKER wrapper exposes the operation via RPC. This is backend authorization independent of legacy customer sessions. Invalid tokens cannot consume quota, and app roles have no table permissions. Both private tables have RLS with no public policies, intentionally denying direct access. This intentional deny-all configuration can appear as an informational no-policy advisor finding. No existing customer/shop/order tables or access policies are changed.

## Data and deterministic tools

The Vercel Node endpoint `POST /api/shopping-assistant` uses existing public Supabase URL/anon-key variables. It reads active shops, service areas, active in-stock products, saved delivery tiers and the selected university name. The university ID is a public area selector, not identity proof. No customer IDs, addresses, phone numbers, coordinates or private order records are sent to the model. Only conversation text is sent; the UI warns users not to include passwords, payment details or private information. Conversations remain in screen memory, without database/local-storage persistence.

`ai@7.0.166` interprets up to six requested items, quantities/units, USD budget and whether delivery is included. An explicit CommonJS-to-ESM bridge loads the AI SDK with native import() for Vercel's runtime. Structured intent is validated with Zod. All product IDs, prices, stock, availability and arithmetic come from server code and public catalogue data, not generated claims.

Pack sizes are derived from a single unambiguous measure in the product name. kg/g, L/ml and multiplication packs are supported. Unknown sizes stay browse-only when a measured quantity is requested. Closed/unavailable shops can appear as browse-only matches but cannot supply a basket. Hours use Africa/Harare. Combined duplicate-product quantities respect stock.

Delivery uses existing per-shop fees and the same tier helper as checkout. The earlier illustrative distance/value formula is not implemented. Unknown fallback delivery fees are not guessed. Budget defaults to including delivery unless the customer explicitly requests goods only. Payment-dependent fees are disclosed separately; checkout still controls final availability, costs and order confirmation.

Suggestions consider up to 12 purchasable options per item and 128 candidate combinations. They are suggested baskets, not a globally cheapest guarantee. Matching is keyword-based after intent interpretation, with common staple/appliance/cosmetic mismatches excluded. Customers must check suitability. Truncated reads are disclosed. Currency conversion, dietary guarantees and automatic substitute approvals are not supported.

## Operational limits and logs

Requests: 8KB, six messages, 1,000 characters per message, 4,000 total characters. Inference timeout: 18 seconds. There is also an eight-per-minute hashed-IP throttle per server instance; that throttle is best-effort, while the monthly quota is enforced centrally in Postgres. Provider logs record failure category/status and, for 403 refusals only, a bounded description with conversation text, credentials and URLs removed. Raw upstream bodies/headers and prompts are not logged. Existing platform logging still applies.

## Verification

- `node scripts/test-shopping-assistant.cjs`: pack sizes, stock, shop/service areas, wrong product-type exclusions, fees/tiers, budgets, currency, Harare hours, parsing, API validation and throttling.
- `node scripts/test-assistant-allowance.cjs`: missing/accepted/exhausted/failed quota reservations, model/regional price changes, sufficient and empty Gateway balances, with all networking mocked.
- Database transaction (rolled back): accept exactly 500 reservations, reject the next, reject invalid tokens and confirm app roles cannot read settings or update counters.
- Security advisors reviewed: no-policy findings on the two private quota tables are intentional deny-all; existing unrelated findings are outside this change.
- TypeScript and Expo web export; browser flow at dark 390px, light 320px and dark desktop 1440px, including an assistant round trip preserving an existing cart, failed-request retry and fallback.
- Production browser flow was verified against the real public catalogue with synthetic browser-only customer details and production writes blocked. Live model activation is verified separately after deployment; do not equate catalogue fallback success with AI activation.

## Live verification after activation

On 2026-11-10, both a direct production request and the production browser flow returned `mode: ai` using the free-tier-eligible model. The browser completed Home → assistant → live catalogue response → exact matching product in the existing shop. The central quota recorded the two reservations. No production orders, payments or customer records were created. The local migration filename was aligned with the exact version recorded by Supabase so future database pushes do not try to reapply it.
