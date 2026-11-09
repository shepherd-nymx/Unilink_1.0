# Customer home middle sections

The customer dashboard keeps Request Delivery and Custom Items at the top of its scrolling content, followed by:

- Three manually browsable shopping banners. Shopping-list actions open the existing custom-item modal; the shop banner opens the marketplace.
- A three-step ordering explainer.
- Today's deliveries, using the customer's saved service-area name and existing messenger listings. Delivery options opens the existing delivery-request service selector. Scheduling continues through the existing per-driver availability flow.
- Featured Shops with saved merchant logos, names and location-verification markers. Up to three active shops serving the customer's location are shown, followed by More Shops. Missing or failed logos use a storefront icon.
- The existing Nearby Shops action.

The sections follow the light/dark theme, fit narrow phones, and retain the persistent customer navigation. The initial home skeleton matches the new arrangement; the shop strip has its own loading placeholders, retry state, and a location-completion prompt.

`shopServesLocation` is shared with the marketplace. Unknown or empty service areas do not match. Featured-shop links pass a shop ID to the marketplace, which validates the active shop and saved service area before selecting its product catalog. Read-only shop queries refresh when the customer returns to Home. Existing custom-order, payment, notification and authentication behavior is retained.

Verification: TypeScript and Expo export passed. Browser checks covered dark/light phone and desktop layouts, 320px overflow, custom-list banner actions, banner pagination, shop logos/fallbacks, service-area filtering, direct product selection, missing-location prompts and failed-query retry. API traffic was mocked and no orders or messages were submitted. Production metadata confirmed existing active shops, merchant logos and service-area settings.
