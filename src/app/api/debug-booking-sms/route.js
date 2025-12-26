import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/shared/lib/supabase';
const { logger } = require('@/shared/lib/logger');

export async function POST(req) {
  try {
    const { bookingId } = await req.json();
    
    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    logger.debug('Debugging SMS for booking', { bookingId });

    // Get the booking with all related data
    const { data: booking, error: bookingError } = await supabaseAdmin
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

    logger.debug('Booking data', {
      bookingId: booking.id,
      hasBarber: !!booking.barber,
      hasClient: !!booking.client,
      hasService: !!booking.service
    });

    // Check SMS prerequisites
    const smsChecks = {
      barber: {
        hasPhone: !!booking.barber?.phone,
        hasCarrier: !!booking.barber?.carrier,
        hasSmsEnabled: booking.barber?.sms_notifications === true,
        willReceiveSms: !!(booking.barber?.phone && booking.barber?.carrier && booking.barber?.sms_notifications)
      },
      client: {
        hasPhone: !!booking.client?.phone,
        hasCarrier: !!booking.client?.carrier,
        hasSmsEnabled: booking.client?.sms_notifications === true,
        willReceiveSms: !!(booking.client?.phone && booking.client?.carrier && booking.client?.sms_notifications)
      }
    };

    logger.debug('SMS Checks', smsChecks);

    // Check environment variables
    const envChecks = {
      hasGmailUser: !!process.env.GMAIL_USER,
      hasGmailPass: !!process.env.GMAIL_PASS,
      gmailUser: process.env.GMAIL_USER ? `${process.env.GMAIL_USER.substring(0, 3)}***` : 'NOT SET'
    };

    logger.debug('Environment Checks', { hasGmailUser: envChecks.hasGmailUser, hasGmailPass: envChecks.hasGmailPass });

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        date: booking.date,
        status: booking.status
      },
      smsChecks,
      envChecks,
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
    logger.error('Debug error', error);
    return NextResponse.json({ 
      error: 'Debug failed',
      details: error.message 
    }, { status: 500 });
  }
} 