-- Allow users to insert reviews without a booking_id (for browse page reviews)
-- These reviews will be unverified since they're not tied to a completed booking

CREATE POLICY "Clients can insert unverified reviews without booking"
    ON reviews FOR INSERT
    WITH CHECK (
        auth.uid() = client_id AND
        booking_id IS NULL
    );

-- Note: The existing policy "Clients can insert reviews for their completed bookings" 
-- handles verified reviews tied to bookings, and this new policy handles unverified reviews
-- without bookings. Both policies can coexist.

