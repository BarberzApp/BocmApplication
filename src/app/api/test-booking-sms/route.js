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

    logger.debug('Testing SMS for booking', { bookingId });

    // Get the booking with all related data
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        barber:barber_id(id, user_id),
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

    // Get the barber's profile data since SMS fields are stored there
    const { data: barberProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('phone, carrier, sms_notifications')
      .eq('id', booking.barber.user_id)
      .single();

    if (profileError) {
      logger.error('Error fetching barber profile', profileError);
      return NextResponse.json({ error: 'Failed to fetch barber profile' }, { status: 500 });
    }

    // Merge the barber profile data with the barber object
    booking.barber = {
      ...booking.barber,
      phone: barberProfile.phone,
      carrier: barberProfile.carrier,
      sms_notifications: barberProfile.sms_notifications
    };

    logger.debug('Retrieved booking data for SMS test', {
      bookingId: booking.id,
      hasBarberPhone: !!booking.barber?.phone,
      hasClientPhone: !!booking.client?.phone,
      hasService: !!booking.service
    });

    // Manually trigger SMS confirmation
    const smsResults = await sendBookingConfirmationSMS({
      booking,
      barber: booking.barber,
      service: booking.service,
      client: booking.client
    });

    return NextResponse.json({
      success: true,
      message: 'SMS test completed',
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
    logger.error('Test booking SMS error', error);
    return NextResponse.json({ 
      error: 'Failed to test booking SMS',
      details: error.message 
    }, { status: 500 });
  }
} 