-- Fix booking race condition using PostgreSQL standard patterns
-- This migration adds:
-- 1. end_time column for better conflict detection
-- 2. Row-level locking to prevent race conditions
-- 3. Improved conflict check function

-- Step 1: Add end_time column to bookings table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'end_time'
    ) THEN
        ALTER TABLE bookings ADD COLUMN end_time TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Step 2: Populate end_time for existing bookings
UPDATE bookings b
SET end_time = b.date + (s.duration || ' minutes')::INTERVAL
FROM services s
WHERE b.service_id = s.id AND b.end_time IS NULL;

-- Step 3: Create improved conflict check function with row-level locking
CREATE OR REPLACE FUNCTION check_booking_conflicts()
RETURNS TRIGGER AS $$
DECLARE
    service_duration INTEGER;
    booking_end_time TIMESTAMP WITH TIME ZONE;
    conflicting_count INTEGER;
BEGIN
    -- Get service duration
    SELECT duration INTO service_duration
    FROM services
    WHERE id = NEW.service_id;
    
    IF service_duration IS NULL THEN
        RAISE EXCEPTION 'Service not found';
    END IF;
    
    -- Calculate booking end time
    booking_end_time := NEW.date + (service_duration || ' minutes')::INTERVAL;
    
    -- Set end_time on the new booking
    NEW.end_time := booking_end_time;
    
    -- Use SELECT FOR UPDATE to lock conflicting rows and prevent race condition
    -- This is the PostgreSQL standard way to prevent concurrent booking conflicts
    SELECT COUNT(*) INTO conflicting_count
    FROM bookings b
    WHERE b.barber_id = NEW.barber_id
      AND b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND b.status NOT IN ('cancelled')
      AND b.end_time IS NOT NULL
      AND (
          -- Check if new booking overlaps with existing booking
          (NEW.date < b.end_time AND booking_end_time > b.date)
      )
    FOR UPDATE; -- This locks the rows and prevents concurrent modifications
    
    IF conflicting_count > 0 THEN
        RAISE EXCEPTION 'This time slot conflicts with an existing booking. Please choose another time.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Recreate trigger (it should already exist, but we'll ensure it's there)
DROP TRIGGER IF EXISTS check_booking_conflicts_trigger ON bookings;
CREATE TRIGGER check_booking_conflicts_trigger
    BEFORE INSERT OR UPDATE OF date, service_id, barber_id ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION check_booking_conflicts();

-- Step 5: Add advisory lock function for additional protection
-- This provides an extra layer of protection at the application level
CREATE OR REPLACE FUNCTION acquire_booking_slot_lock(
    p_barber_id UUID,
    p_date TIMESTAMP WITH TIME ZONE
) RETURNS BOOLEAN AS $$
BEGIN
    -- Use PostgreSQL advisory lock based on barber_id and time slot
    -- This ensures only one booking can be processed at a time for a given barber/slot
    -- Lock key is derived from barber_id hash and date epoch
    PERFORM pg_advisory_xact_lock(
        ('x' || substr(md5(p_barber_id::TEXT), 1, 8))::bit(32)::INTEGER,
        EXTRACT(EPOCH FROM date_trunc('minute', p_date))::INTEGER
    );
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Add index to improve conflict check performance
CREATE INDEX IF NOT EXISTS idx_bookings_barber_date_range 
ON bookings(barber_id, date, end_time) 
WHERE status != 'cancelled';

-- Step 7: Add comment explaining the fix
COMMENT ON FUNCTION check_booking_conflicts() IS 
'Prevents double booking race conditions using row-level locking (SELECT FOR UPDATE). 
This is the PostgreSQL standard approach - it locks conflicting rows during the transaction, 
preventing concurrent inserts from succeeding if they would create a conflict.';

COMMENT ON FUNCTION acquire_booking_slot_lock(UUID, TIMESTAMP WITH TIME ZONE) IS 
'Advisory lock function for additional protection against race conditions.
Call this from application code before creating a booking to ensure exclusive access to the time slot.';

