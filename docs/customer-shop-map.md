# Customer portal shop map

The customer dashboard renders `CustomerShopMap` above the existing Nearby shops action. The entire interactive section is sized to 50% of the current window height and resizes with the viewport. Existing orders, assistant and navigation remain available below it.

Only saved shops with `status = active` and valid latitude/longitude appear. Both coordinates are required, finite and in geographic bounds; `(0,0)` is treated as an unset placeholder, while individual zero coordinates remain valid. Registration now rejects partial or out-of-range coordinate pairs. Pending, payment-required, suspended, rejected and missing-GPS shops stay hidden; closed-but-active shops remain discoverable and are labelled unavailable when selected.

Customers can search shop names, addresses and categories, filter by category, tap keyboard-accessible shop pins, view address/category/logo, and use Visit shop to navigate to the existing marketplace with the shop ID. The marketplace retains its saved delivery-service-area checks. A pin is discovery, not a promise of delivery coverage. Customer location is requested only after pressing the locate button; coordinates are kept in component state and never written to the database.

## Free map stack

Leaflet 1.9.4 and MarkerCluster 1.5.3 are pinned CDN resources with subresource integrity. No new package or paid map key is needed. Browser rendering uses an isolated iframe; native builds use the already installed WebView. Map messages are validated against the sending frame and known shop IDs. Public shop data is JSON-escaped and labels use textContent. Authentication tokens never enter the map document.

Tiles use `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, with visible OpenStreetMap attribution. Scroll-wheel zoom is disabled to keep dashboard scrolling usable. Touch dragging/pinch and zoom buttons remain supported. Overlapping pins cluster/spiderfy. There is no tile prefetch, bulk download or offline map cache. The app's service worker already skips external origins. Browser requests retain their referrer; native WebView identifies the app. Standard OpenStreetMap tiles are a best-effort shared service subject to the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/), not unlimited hosting or an SLA. Move to a suitable tile provider before traffic exceeds that service's intended use.

If tile/CDN loading fails, an error notice offers retry or the searchable shop list. List selection opens the same shop details and marketplace action. Empty/no-match and data-fetch failure states have explicit messages.

## Verification

- `npm run typecheck`
- `npm run build:web`
- `node scripts/test-shop-map.cjs`: coordinate bounds/malformed values, active-only visibility, category/search filtering and escaped map-document payloads.
- Chromium at 390 × 844: measured 422px map section; real Leaflet/MarkerCluster assets; pin selection, invalid/GPS-less/suspended exclusions, search, list selection and navigation into the selected shop's products. Browser API responses were fixtures; no accounts or orders were created.
- Live public Supabase query checks that existing RLS permits the selected active-shop public fields. No database schema or authorization policy changes.

Native code is included, but an Android/iOS device build still needs device-level WebView/gesture verification before a store release.
