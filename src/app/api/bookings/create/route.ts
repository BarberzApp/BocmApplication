import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/shared/lib/supabase"
import { sendBookingConfirmationSMS } from "@/shared/utils/sendSMS"
import { logger } from "@/shared/lib/logger"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      barber_id, 
      service_id, 
      date, 
      end_time,
      price, 
      client_id, 
      guest_name, 
      guest_email, 
      guest_phone, 
      payment_intent_id, 
      platform_fee, 
      barber_payout, 
      notes 
    } = body

    // Validate required fields
    if (!barber_id || !service_id || !date || !price) {
      return NextResponse.json(
        { error: 'Missing required booking fields' },
        { status: 400 }
      )
    }

    // Optional: basic conflict prevention (keep simple)
    // If end_time is provided, ensure no overlap with existing non-cancelled bookings
    if (end_time) {
      const { data: conflicts, error: conflictError } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('barber_id', barber_id)
        .neq('status', 'cancelled')
        .or(`and(date.lt.${end_time},end_time.gt.${date})`)

      if (conflictError) {
        return NextResponse.json(
          { error: 'Failed to check availability' },
          { status: 500 }
        )
      }

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { error: 'Time slot conflicts with an existing booking' },
          { status: 409 }
        )
      }
    }

    // Fetch service price to store historically (required for accurate pricing even if service price changes later)
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('price')
      .eq('id', service_id)
      .single()

    if (serviceError || !service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 400 }
      )
    }

    const service_price = service.price ? Number(service.price) : null

    // Create the booking using the admin client
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        barber_id,
        service_id,
        date,
        end_time: end_time || null,
        price,
        service_price, // Store historical service price
        status: "confirmed",
        payment_status: "succeeded",
        payment_intent_id: payment_intent_id || null,
        platform_fee: platform_fee || null,
        barber_payout: barber_payout || null,
        notes: notes || null,
        client_id: client_id === 'guest' ? null : client_id,
        guest_name: guest_name || null,
        guest_email: guest_email || null,
        guest_phone: guest_phone || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        *,
        barber:barber_id(id, user_id),
        service:service_id(*),
        client:client_id(*)
      `)
      .single()

    if (bookingError) {
      logger.error('Error creating booking', bookingError)
      
      // Handle specific constraint violations with 409 status
      if (bookingError.message.includes('Booking time conflicts with existing booking')) {
        return NextResponse.json(
          { error: 'This time slot is already booked. Please select a different time.' },
          { status: 409 }
        )
      }
      
      if (bookingError.message.includes('Booking time is not within barber availability')) {
        return NextResponse.json(
          { error: 'This time is outside the barber\'s available hours.' },
          { status: 409 }
        )
      }
      
      if (bookingError.message.includes('Daily booking limit exceeded')) {
        return NextResponse.json(
          { error: 'The barber has reached their daily booking limit.' },
          { status: 409 }
        )
      }
      
      if (bookingError.message.includes('Booking too far in advance')) {
        return NextResponse.json(
          { error: 'This booking is too far in advance. Please select a closer date.' },
          { status: 409 }
        )
      }
      
      if (bookingError.message.includes('Same day bookings not allowed')) {
        return NextResponse.json(
          { error: 'Same day bookings are not allowed for this barber.' },
          { status: 409 }
        )
      }
      
      if (bookingError.message.includes('Minimum interval between bookings not met')) {
        return NextResponse.json(
          { error: 'There must be more time between bookings.' },
          { status: 409 }
        )
      }
      
      // Handle PostgreSQL constraint violation codes
      if (bookingError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'A booking already exists for this time slot.' },
          { status: 409 }
        )
      }
      
      if (bookingError.code === '23514') { // Check constraint violation
        return NextResponse.json(
          { error: 'Booking violates business rules. Please check the time and date.' },
          { status: 409 }
        )
      }
      
      // Generic database error
      return NextResponse.json(
        { error: `Database error: ${bookingError.message}` },
        { status: 500 }
      )
    }

    // Get the barber's profile data for SMS
    let barberWithSmsData = booking;
    if (booking.barber) {
      try {
        const { data: barberProfile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('phone, carrier, sms_notifications')
          .eq('id', booking.barber.user_id)
          .single();

        if (!profileError && barberProfile) {
          barberWithSmsData = {
            ...booking,
            barber: {
              ...booking.barber,
              phone: barberProfile.phone,
              carrier: barberProfile.carrier,
              sms_notifications: barberProfile.sms_notifications
            }
          };
        }
      } catch (error) {
        logger.error('Failed to fetch barber profile for SMS', error);
      }
    }

    // Send SMS notifications to both barber and client
    try {
      logger.debug('Sending SMS notifications for booking', { bookingId: booking.id })
      const smsResults = await sendBookingConfirmationSMS(barberWithSmsData)
      logger.debug('SMS notification results', { results: smsResults })
    } catch (smsError) {
      logger.error('Failed to send SMS notifications', smsError)
      // Don't fail the booking creation if SMS fails
    }

    return NextResponse.json({ booking })
  } catch (error) {
    logger.error('Error in booking creation API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 