# Page loading skeletons

`PageSkeleton` maps each data-loading route to its upcoming layout: customer home, dashboards, marketplace grids, order cards, editable forms, conversation lists, message bubbles, policies, receipts or management records. It replaces initial loading visuals and retains the existing loading flags and data/error handling. Existing back actions remain available where the old loading header provided them.

`embedded` renders only a loading section under an existing header. `fill` occupies the remaining screen height for message timelines and full-height lists. Document panels and inline dashboard sections use a bounded loading area. The current customer home skeleton mirrors the banner, Nearby Shops, Request Delivery, Custom Items, and mobile navigation or desktop sidebar.

Registration pages show a field-sized skeleton while their service-location choices load; the rest of the form remains usable. Verified-identity registration and the identity callback show an account-form placeholder until identity checking completes. Instantly rendered screens do not receive a forced delay, and saving/sending/uploading buttons retain their action indicators.

`SkeletonGroup` shares one opacity pulse across its blocks, stops it on unmount, and disables pulsing for reduced-motion users. Neutral colors follow the actual page palette, including the admin/messenger/chat screens that intentionally use a fixed dark theme. Placeholders announce an indeterminate loading state; decorative blocks are hidden from screen readers.

Verification covered loading-to-ready/empty transitions on 22 representative routes across all portals, phone and desktop home layouts, dark/light palettes, a failed profile request, the authenticated email-log flow, registration choices for all three portals, chat-message loading, and reduced-motion behavior. Tests mocked all API traffic and sent no messages or production data writes. TypeScript checks and Expo web export passed. Source comparison confirmed existing database and auth calls were retained.
