-- Add service_price field to bookings table to store historical service price
-- This ensures that if a barber changes their service price, old bookings still show the correct price

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS service_price DECIMAL(10,2);

-- Add comment explaining the field
COMMENT ON COLUMN bookings.service_price IS 'Historical service price at time of booking. Used to preserve pricing accuracy even if service price changes later.';

-- For existing bookings, we can try to backfill from services table
-- But this is optional and may not be accurate if service prices have changed
UPDATE bookings
SET service_price = (
  SELECT price 
  FROM services 
  WHERE services.id = bookings.service_id
)
WHERE service_price IS NULL;

