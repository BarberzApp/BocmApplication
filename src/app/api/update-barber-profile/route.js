import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/shared/lib/supabase';
const { logger } = require('@/shared/lib/logger');

export async function POST(req) {
  try {
    const { bookingId } = await req.json();
    
    if (!bookingId) {
      return NextResponse.json({ 
        error: 'Booking ID is required' 
      }, { status: 400 });
    }

    logger.debug('Manually updating barber profile for booking', { bookingId });

    // Get the booking to find the barber
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('barber_id, client:client_id(phone, carrier)')
      .eq('id', bookingId)
      .single();

    if (bookingError) {
      logger.error('Error fetching booking', bookingError);
      return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 });
    }

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Get the barber to find their user_id
    const { data: barber, error: barberError } = await supabaseAdmin
      .from('barbers')
      .select('user_id')
      .eq('id', booking.barber_id)
      .single();

    if (barberError) {
      logger.error('Error fetching barber', barberError);
      return NextResponse.json({ error: 'Failed to fetch barber' }, { status: 500 });
    }

    logger.debug('Found barber user_id', { userId: barber.user_id });
    logger.debug('Client SMS data', { hasPhone: !!booking.client?.phone, hasCarrier: !!booking.client?.carrier });

    // Update the barber's profile with SMS data
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        phone: booking.client.phone,
        carrier: booking.client.carrier,
        sms_notifications: true
      })
      .eq('id', barber.user_id);

    if (updateError) {
      logger.error('Error updating profile', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    logger.debug('Profile updated successfully');

    // Verify the update
    const { data: updatedProfile, error: verifyError } = await supabaseAdmin
      .from('profiles')
      .select('phone, carrier, sms_notifications')
      .eq('id', barber.user_id)
      .single();

    if (verifyError) {
      logger.error('Error verifying update', verifyError);
      return NextResponse.json({ error: 'Failed to verify update' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Barber profile updated successfully',
      barberUserId: barber.user_id,
      updatedProfile,
      debug: {
        originalClientPhone: booking.client.phone,
        originalClientCarrier: booking.client.carrier
      }
    });

  } catch (error) {
    logger.error('Update barber profile error', error);
    return NextResponse.json({ 
      error: 'Failed to update barber profile',
      details: error.message 
    }, { status: 500 });
  }
} 