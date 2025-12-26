import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/shared/lib/supabase';
import { sendBookingConfirmationSMS } from '@/shared/utils/sendSMS';
const { logger } = require('@/shared/lib/logger');

export async function POST(req) {
  try {
    const { bookingId } = await req.json();
    
    if (!bookingId) {
      return NextResponse.json({ 
        error: 'Booking ID is required' 
      }, { status: 400 });
    }

    logger.debug('Fixing barber SMS data for booking', { bookingId });

    // Get the booking with all related data
    let { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        barber:barber_id(*),
        service:service_id(*),
        client:client_id(*)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError) {
      logger.error('Error fetching booking', bookingError);
      return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 });
    }

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check if barber data is missing SMS fields
    if (!booking.barber.phone || !booking.barber.carrier || booking.barber.sms_notifications === undefined) {
      logger.debug('Barber SMS data is missing, updating profiles table');
      
      // Update the barber's profile with SMS data (using client data since it's the same person)
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          phone: booking.client.phone,
          carrier: booking.client.carrier,
          sms_notifications: true
        })
        .eq('id', booking.barber.user_id);

      if (updateError) {
        logger.error('Error updating barber profile SMS data', updateError);
        return NextResponse.json({ error: 'Failed to update barber profile SMS data' }, { status: 500 });
      }

      logger.debug('Barber profile SMS data updated successfully');
      
      // Fetch the updated booking data
      const { data: updatedBooking, error: fetchError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          barber:barber_id(*),
          service:service_id(*),
          client:client_id(*)
        `)
        .eq('id', bookingId)
        .single();

      if (fetchError) {
        logger.error('Error fetching updated booking', fetchError);
        return NextResponse.json({ error: 'Failed to fetch updated booking' }, { status: 500 });
      }

      booking = updatedBooking;
    }

    logger.debug('Updated booking data', {
      bookingId: booking.id,
      hasBarberPhone: !!booking.barber?.phone,
      hasClientPhone: !!booking.client?.phone
    });

    // Now test the SMS
    const smsResults = await sendBookingConfirmationSMS(booking);

    return NextResponse.json({
      success: true,
      message: 'Barber SMS data fixed and SMS test completed',
      bookingId: booking.id,
      smsResults,
      debug: {
        barberPhone: booking.barber?.phone,
        barberCarrier: booking.barber?.carrier,
        barberSmsEnabled: booking.barber?.sms_notifications,
        clientPhone: booking.client?.phone,
        clientCarrier: booking.client?.carrier,
        clientSmsEnabled: booking.client?.sms_notifications
      }
    });

  } catch (error) {
    logger.error('Fix barber SMS error', error);
    return NextResponse.json({ 
      error: 'Failed to fix barber SMS',
      details: error.message 
    }, { status: 500 });
  }
} 