# Customer marketplace presentation

The shop-selection screen follows the approved dark navy marketplace concept, with uppercase UNILINK and no graduation-cap brand icon. Light mode uses the same layout with its existing light palette. Content is centered and constrained to 760px on large screens; phone layouts wrap long shop names and allow category and area chips to scroll horizontally.

MarketplaceShopCard displays saved shop logos with a storefront fallback, descriptions, category/location, actual availability and existing tier/student/free-delivery/location-verification metadata. The whole card opens the existing catalog. No ratings, offers, hours or locations are fabricated. The existing persistent customer navigation is reused.

The loading skeleton mirrors the header, filters and vertical shop cards. Search, category and area filtering, service-area checks, shop selection, product catalog, cart, checkout and order functions retain their existing logic.

Validation: TypeScript, Expo web export, browser checks at dark 390px, light 320px and dark desktop 1440px; brand, valid/missing/broken logos, statuses, search and no matches, both filter types, catalog selection, cart and persistent navigation. Browser tests use synthetic sessions and mocked API responses without production writes. Existing named marketplace functions were compared to the previous commit and are unchanged.
