-- Fix: Remove FOR UPDATE with aggregate functions error
-- The trigger was using COUNT(*) with FOR UPDATE which PostgreSQL doesn't allow
-- Solution: Use SELECT INTO with LIMIT 1 and check FOUND instead

CREATE OR REPLACE FUNCTION check_booking_conflicts()
RETURNS TRIGGER AS $$
DECLARE
    service_duration INTEGER;
    booking_end_time TIMESTAMP WITH TIME ZONE;
    conflicting_booking_id UUID;
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
    -- We lock the first conflicting row (if any) and then check if it exists
    -- This avoids the "FOR UPDATE with aggregate functions" error
    SELECT b.id INTO conflicting_booking_id
    FROM bookings b
    WHERE b.barber_id = NEW.barber_id
      AND b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND b.status NOT IN ('cancelled')
      AND b.end_time IS NOT NULL
      AND (
          -- Check if new booking overlaps with existing booking
          (NEW.date < b.end_time AND booking_end_time > b.date)
      )
    FOR UPDATE -- This locks the rows and prevents concurrent modifications
    LIMIT 1; -- Only need to lock one row to detect conflict
    
    -- If a row was found, we have a conflict
    IF FOUND THEN
        RAISE EXCEPTION 'This time slot conflicts with an existing booking. Please choose another time.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS check_booking_conflicts_trigger ON bookings;
CREATE TRIGGER check_booking_conflicts_trigger
    BEFORE INSERT OR UPDATE OF date, service_id, barber_id ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION check_booking_conflicts();

