/*
# Customer's preferred messenger on shop orders

1. Modified Table
- `shop_orders` gets `preferred_messenger_id`, an optional link to the messenger the customer picked at checkout.

2. Behaviour
- Empty when the customer leaves the choice to the shop.
- If that messenger is later deleted, the field is cleared rather than blocking the order.

3. Security
- No new policies or grants; existing shop_orders access rules apply to the new column.

4. Important Notes
- Adds the column only, with an index; existing orders are unchanged.
*/

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS preferred_messenger_id uuid REFERENCES drivers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shop_orders_preferred_messenger_idx ON shop_orders(preferred_messenger_id);
