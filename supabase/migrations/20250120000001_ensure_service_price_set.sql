-- Ensure service_price is set for all bookings
-- This migration backfills missing service_price values and adds a constraint

-- Step 1: Backfill missing service_price values from services table
UPDATE bookings
SET service_price = (
  SELECT price 
  FROM services 
  WHERE services.id = bookings.service_id
)
WHERE service_price IS NULL;

-- Step 2: Add comment to clarify the price field semantics
COMMENT ON COLUMN bookings.price IS 'Total amount charged. For fee-only bookings: platform_fee + barber_payout (platform fee only, ~$3.38). For developer bookings: service_price + addon_total (full price, no platform fee).';

COMMENT ON COLUMN bookings.service_price IS 'Historical service price at time of booking. Required for accurate historical pricing.';

COMMENT ON COLUMN bookings.platform_fee IS 'BOCM platform share (in dollars). For fee-only bookings: part of the platform fee split.';

COMMENT ON COLUMN bookings.barber_payout IS 'Barber share from platform fee (in dollars). For fee-only bookings: part of the platform fee split.';

-- Step 3: Add check constraint to ensure service_price is set for non-developer bookings
-- Note: We can't easily detect developer bookings in a constraint, so we'll just ensure
-- service_price is NOT NULL. Developer bookings will have service_price set too.
ALTER TABLE bookings
ALTER COLUMN service_price SET NOT NULL;

-- Step 4: Add default value from services table (for future inserts)
-- This requires a trigger since DEFAULT can't reference other tables
CREATE OR REPLACE FUNCTION set_service_price_default()
RETURNS TRIGGER AS $$
BEGIN
  -- If service_price is not provided, fetch it from services table
  IF NEW.service_price IS NULL THEN
    SELECT price INTO NEW.service_price
    FROM services
    WHERE id = NEW.service_id;
    
    -- If service not found, raise an error (service_price is required)
    IF NEW.service_price IS NULL THEN
      RAISE EXCEPTION 'Service not found or has no price for service_id: %', NEW.service_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS set_service_price_default_trigger ON bookings;

-- Create trigger to set service_price before insert
CREATE TRIGGER set_service_price_default_trigger
BEFORE INSERT ON bookings
FOR EACH ROW
WHEN (NEW.service_price IS NULL)
EXECUTE FUNCTION set_service_price_default();

COMMENT ON FUNCTION set_service_price_default() IS 'Automatically sets service_price from services table if not provided during booking creation';

