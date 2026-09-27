/*
# Add driver assignment mode to shops

1. Changes
- `shops.driver_assignment_mode`: new column, text, default 'shop_assigned'
  - 'shop_assigned' = shop chooses and assigns the driver (current flow)
  - 'customer_assigned' = customer chooses a driver at checkout, sends WhatsApp first
- Added CHECK constraint on the column to only allow those two values
2. Rationale
- Shops need a setting to control who picks the driver for deliveries:
  - When 'shop_assigned', the shop owner assigns a driver from their dashboard (current behavior).
  - When 'customer_assigned', the customer selects a driver during checkout, must send
    a WhatsApp message to that driver first, then the order is placed with the driver
    already assigned. The shop only sees order details (items bought + driver coming).
    The driver marks all tracking events.
3. Security
- No new tables. No RLS policy changes needed — existing shop update policies
  already allow shop owners to update their own row columns.
4. Notes
- Default is 'shop_assigned' so all existing shops keep the current flow.
- The column is nullable-safe (has a default), so no existing rows break.
*/

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS driver_assignment_mode text
  NOT NULL DEFAULT 'shop_assigned'
  CHECK (driver_assignment_mode IN ('shop_assigned', 'customer_assigned'));