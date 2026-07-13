/*
  # Make GPS Coordinates Required for Customers

  ## Changes
  1. Set default values for existing customers without GPS coordinates
  2. Make latitude and longitude columns NOT NULL
  
  ## Notes
  - Existing customers without coordinates will get default values (0, 0)
  - New customers must provide GPS coordinates
*/

UPDATE customers 
SET latitude = 0, longitude = 0 
WHERE latitude IS NULL OR longitude IS NULL;

ALTER TABLE customers 
ALTER COLUMN latitude SET NOT NULL,
ALTER COLUMN longitude SET NOT NULL;
