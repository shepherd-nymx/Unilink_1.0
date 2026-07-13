/*
# Add WhatsApp number to drivers

Adds an optional `whatsapp_number` column to the `drivers` table so each driver
can store the phone number customers should use to send them a WhatsApp message
when an order is placed.

## Changes
- `drivers.whatsapp_number` (text, nullable) — international format e.g. +263712345678
*/

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS whatsapp_number text;
