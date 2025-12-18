-- Fix booking trigger to handle duration calculation more safely
-- The issue is that if service_duration is NULL, the concatenation results in " minutes" which is invalid

CREATE OR REPLACE FUNCTION check_booking_conflicts()
RETURNS TRIGGER AS $$
DECLARE
    service_duration INTEGER;
    booking_end_time TIMESTAMP WITH TIME ZONE;
    conflicting_booking_id UUID;
BEGIN
    -- Get service duration with better error handling
    SELECT duration INTO service_duration
    FROM services
    WHERE id = NEW.service_id;
    
    IF service_duration IS NULL THEN
        RAISE EXCEPTION 'Service not found or duration is NULL for service_id: %', NEW.service_id;
    END IF;
    
    -- Ensure duration is a valid positive integer
    IF service_duration <= 0 THEN
        RAISE EXCEPTION 'Invalid service duration: % (must be > 0)', service_duration;
    END IF;
    
    -- Calculate booking end time using make_interval for safer interval creation
    -- This avoids string concatenation issues
    booking_end_time := NEW.date + make_interval(mins => service_duration);
    
    -- Set end_time on the new booking
    NEW.end_time := booking_end_time;
    
    -- Use SELECT FOR UPDATE to lock conflicting rows and prevent race condition
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
    FOR UPDATE
    LIMIT 1;
    
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

