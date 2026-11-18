# UniLink WhatsApp ordering

## Status and setup

The webhook and service-only database workflow are installed. **Conversation processing remains PAUSED** until the operator connects Meta's webhook and explicitly enables the bot in Admin → WhatsApp ordering bot. Existing activity email alerts remain enabled. Google routing remains unused; delivery uses the shop's published fee/tier settings. No model provider is needed for this menu-based bot.

Webhook callback:

`https://yysnoiamfoveltvyjzgx.supabase.co/functions/v1/whatsapp-order-bot`

For a fresh Meta test app, add these in Supabase Edge Function Secrets:

- `WHATSAPP_BOT_ACCESS_TOKEN`: token from the new app's WhatsApp API Setup.
- `WHATSAPP_BOT_PHONE_NUMBER_ID`: the API Phone Number ID, not the displayed phone number or WABA ID.
- `WHATSAPP_BOT_APP_SECRET`: the new Meta app's App Settings → Basic → App Secret.
- `WHATSAPP_BOT_VERIFY_TOKEN`: a long random verification string chosen by the operator. Enter the same value in Meta's webhook configuration.

The bot also supports existing shared `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` and `WHATSAPP_VERIFY_TOKEN`. Bot-specific settings take precedence. All four credentials should belong to the same Meta app/number setup. Public health responses reveal only presence flags, never values. Graph API defaults to v25.0; optional server setting `WHATSAPP_GRAPH_VERSION` selects another supported version.

In Meta, create/select the UniLink app with the WhatsApp use case, use **Basic setup → Step 1. Try it out** for the test number and credentials, and add your own recipient number for testing. Set the callback URL and verification token and subscribe to `messages`. Production requires an appropriately registered sender and production access token (the API Setup token is temporary). Never put access tokens, app secrets, verification tokens or customer passwords into chat or public frontend variables.

Then load the admin status, confirm the credentials belong to the intended number, enable the bot, and send **Hi** from an approved test recipient to that number. A valid reply and actual order should be tested by the operator before opening the bot to customers. This implementation never sends an unsolicited test message automatically.

## Customer flow

1. Choose Shop now and a town/area. Only active, available shops with matching saved service locations are listed, with pagination.
2. Select a shop, products and quantities. A basket supports 30 distinct products and up to 1,000 units per product, subject to actual stock. Each shop is a separate order/delivery.
3. Share the actual delivery GPS location using WhatsApp location sharing, then type address details and the recipient name.
4. Choose an accepted payment method: pay on delivery, EcoCash with the shop's saved details, or a secure Paynow link. A typed EcoCash reference does not mark payment received. Paynow link creation uses the authoritative order total; uncertain initiation is never automatically repeated. Card details and payment PINs are never requested in chat.
5. Read the current terms/privacy page and explicitly agree. This is transactional messaging and creates no marketing opt-in.
6. Review product quantities/prices, fees, total, address and GPS; confirm the order. All values and availability are checked on the server again. A changed price/fee/terms snapshot requires a fresh confirmation.
7. My orders shows only orders created by this privately bound WhatsApp identity. Pending orders may be cancelled, restoring reserved stock exactly once. Existing product visibility rules continue to apply (a zero-stock product may require the shop to reactivate it after restocking).

New WhatsApp numbers can create a guest customer profile at confirmed checkout. A number matching an existing UniLink account is NOT automatically attached to that account: the bot saves the basket and asks support to verify ownership. The administrator can link a verified customer record using the admin page. Neither typed phone numbers nor editable profile `auth_id` fields grant access to old orders. The bot never displays existing app-only orders; linking enables new bot orders for the verified customer.

If reviewed delivery quoting is activated, this bot blocks checkout and directs the customer to support for a quote. It does not invent a transport/load/distance fee or bypass the quote guard.

## Reliability and privacy

Meta GET verification uses the configured verify token; POST events require an HMAC-SHA256 signature with the Meta app secret and the configured recipient Phone Number ID. Customer actions use service-only RPCs; browser roles cannot access WhatsApp state, inbox, outbox, account mappings, stock reservations or order links. Admin actions recheck the existing administrator credentials, kept only in page memory.

Incoming Meta message IDs are deduplicated in the same transaction as order creation and stock reservation, with a per-sender transaction lock. Repeated confirmations cannot create another order. Stock is locked, checked and reserved atomically. Private mappings restrict order lookup/cancellation. Raw webhook bodies, customer passwords, voice notes and image contents are not stored by this bot. Stored state includes the necessary basket, name, address and GPS for ordering.

Outgoing replies use a durable queue, background processing and a one-minute recovery cron authenticated by a private Vault capability. Replies stop when the customer service window expires. Only an explicit rate-limit rejection is retried automatically. A timeout or ambiguous provider outcome becomes `uncertain`; check Meta status before manual resend. Signed delivery callbacks can reconcile uncertain sends through the opaque outbox ID. This avoids claiming exactly-once network delivery where Meta offers no such guarantee.

Orders and product/account changes use the existing business-activity email queue. Each new WhatsApp message also creates a UniLink-only activity email containing channel/kind/last four sender digits, not its private body or GPS. Existing email delivery failure never rolls back a committed order.

Payment URLs are saved in the service-only bot order ledger. The bot does not trust legacy browser-writable Paynow transaction URLs or statuses as proof of payment; a secure link is not a receipt. Shop/provider confirmation is required.

## Verification

- `npm run typecheck` and production web export.
- `node scripts/test-whatsapp-webhook.cjs`: signed webhook/challenge validation, recipient business isolation, worker authentication, paused sending and native list/button/location payloads; provider calls mocked.
- `scripts/test-whatsapp-orders.sql`, always wrapped in BEGIN/ROLLBACK: complete native ordering, authoritative fees, stock reservation/cancellation, duplicate messages and confirmations, private order lookup, changed-price reconfirmation, insufficient stock, existing-account collision/admin linking, forged payment record rejection and quote-workflow blocking. Synthetic fixtures and outbox entries are rolled back; no real WhatsApp messages, emails or payment requests are sent by these tests.

The admin page reports queued/sent/failed/uncertain/expired replies and recent conversation stages. Review failed or uncertain records using privileged operations; do not expose these tables to browser roles to build diagnostics.
