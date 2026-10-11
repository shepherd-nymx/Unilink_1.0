/*
# Add audience targeting to announcements

- `audience` controls who sees the broadcast:
  - 'customers' — only the customer portal
  - 'drivers'   — only the driver portal
  - 'all'       — both portals
- Existing rows keep the default 'customers' so current behaviour is unchanged.
*/

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'customers'
  CHECK (audience IN ('customers', 'drivers', 'all'));
