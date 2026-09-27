/*
# Fix active_driver_tokens view to include web platform

## Problem
The `active_driver_tokens` view filters to only `android` and `ios` platforms.
This is a web-first Expo app — drivers logging in on web register a `web` device token,
but the view excludes them. The `get_nearby_drivers` RPC requires an entry in this view,
so web-based available drivers never show up during marketplace checkout.

## Changes
- Recreate the `active_driver_tokens` view to include `web` platform tokens alongside
  `android` and `ios`.
- No data loss — this is a view, not a table.

## Security
- This view is used internally by the `get_nearby_drivers` SECURITY DEFINER function.
- No RLS changes needed — views don't have RLS; the underlying tables are already protected.
*/

DROP VIEW IF EXISTS public.active_driver_tokens;
CREATE OR REPLACE VIEW public.active_driver_tokens AS
  SELECT
    dt.id,
    dt.user_id,
    dt.device_id,
    dt.push_token,
    dt.platform,
    dt.last_active
  FROM device_tokens dt
  JOIN drivers d ON d.id = dt.user_id
  WHERE dt.last_active > (now() - '30 days'::interval)
    AND dt.platform = ANY (ARRAY['android', 'ios', 'web']);
