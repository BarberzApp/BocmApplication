import { NextResponse } from "next/server"
import { supabaseAdmin } from '@/shared/lib/supabase'
import { sendBookingConfirmationSMS } from "@/shared/utils/sendSMS"
import { logger } from '@/shared/lib/logger'

export async function POST(request: Request) {
  try {
    logger.debug('Creating developer booking (bypassing Stripe)...')
    const body = await request.json()
    logger.debug('Request body', { body })
    
    const { 
      barberId, 
      serviceId, 
      date, 
      notes, 
      guestName, 
      guestEmail, 
      guestPhone, 
      clientId, 
      paymentType,
      addonIds = []
    } = body

    // Validate required fields
    if (!barberId || !serviceId || !date) {
      return NextResponse.json(
        { error: 'barberId, serviceId, and date are required' },
        { status: 400 }
      )
    }

    // Verify the barber is actually a developer
    const { data: barber, error: barberError } = await supabaseAdmin
      .from('barbers')
      .select('id, business_name, is_developer')
      .eq('id', barberId)
      .single()

    if (barberError || !barber) {
      return NextResponse.json(
        { error: 'Barber not found' },
        { status: 400 }
      )
    }

    if (!barber.is_developer) {
      return NextResponse.json(
        { error: 'This endpoint is only for developer accounts' },
        { status: 400 }
      )
    }

    // Get service details
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('name, price, duration')
      .eq('id', serviceId)
      .single()

    if (serviceError || !service?.price) {
      return NextResponse.json(
        { error: 'Service not found or missing price' },
        { status: 400 }
      )
    }

    const servicePrice = Number(service.price)
    
    // Get add-ons if any are selected (deduplicate first)
    let addonTotal = 0
    
    if (addonIds && addonIds.length > 0) {
      // Deduplicate addon IDs to prevent double-counting
      const uniqueAddonIds = [...new Set(addonIds)]
      const { data: addons, error: addonsError } = await supabaseAdmin
        .from('service_addons')
        .select('id, name, price')
        .in('id', uniqueAddonIds)
        .eq('is_active', true)

      if (addonsError) {
        return NextResponse.json(
          { error: 'Failed to fetch add-ons' },
          { status: 500 }
        )
      }

      addonTotal = addons.reduce((total, addon) => total + addon.price, 0)
    }
    
    // For developer accounts, no platform fees
    const platformFee = 0
    const barberPayout = servicePrice + addonTotal // Keep in dollars for consistency

    // Create the booking directly (no payment processing needed)
    const bookingData = {
      barber_id: barberId,
      service_id: serviceId,
      date: date,
      notes: notes || '',
      guest_name: guestName || null,
      guest_email: guestEmail || null,
      guest_phone: guestPhone || null,
      client_id: clientId || null,
      status: 'confirmed',
      payment_status: 'succeeded', // Developer bookings are automatically paid
      price: servicePrice + addonTotal,
      service_price: servicePrice, // Store historical service price
      addon_total: 0, // Let the trigger calculate this from booking_addons
      platform_fee: platformFee,
      barber_payout: barberPayout,
      payment_intent_id: `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate a unique ID
    }

    logger.debug('Attempting to insert booking with data', { bookingData })

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert(bookingData)
      .select('*, barber:barber_id(*), service:service_id(*), client:client_id(*)')
      .single()

    if (bookingError) {
      logger.error('Error creating booking', bookingError)
      logger.error('Error details', {
        message: bookingError.message,
        details: bookingError.details,
        hint: bookingError.hint,
        code: bookingError.code
      })
      return NextResponse.json(
        { error: `Failed to create booking: ${bookingError.message}` },
        { status: 500 }
      )
    }

    // Add add-ons to the booking if any were selected (deduplicate first)
    if (addonIds && addonIds.length > 0) {
      const uniqueAddonIds = [...new Set(addonIds)]
      const { data: addons } = await supabaseAdmin
        .from('service_addons')
        .select('id, price')
        .in('id', uniqueAddonIds)
        .eq('is_active', true)

      if (addons && addons.length > 0) {
        const bookingAddons = addons.map(addon => ({
          booking_id: booking.id,
          addon_id: addon.id,
          price: addon.price
        }))

        const { error: addonError } = await supabaseAdmin
          .from('booking_addons')
          .insert(bookingAddons)

        if (addonError) {
          logger.error('Error adding add-ons to booking', addonError)
        }
      }
    }

    // Send SMS notifications to both barber and client
    try {
      logger.debug('Sending SMS notifications for developer booking', { bookingId: booking.id })
      const smsResults = await sendBookingConfirmationSMS(booking)
      logger.debug('SMS notification results', { smsResults })
    } catch (smsError) {
      logger.error('Failed to send SMS notifications', smsError)
      // Don't fail the booking creation if SMS fails
    }

    logger.debug('Developer booking created successfully', {
      bookingId: booking.id,
      barberId: booking.barber_id,
      serviceId: booking.service_id,
      date: booking.date,
      price: booking.price,
      addonTotal: addonTotal
    })

    // Return success response with booking details
    return NextResponse.json({ 
      success: true,
      booking: {
        id: booking.id,
        barber_id: booking.barber_id,
        service_id: booking.service_id,
        date: booking.date,
        status: booking.status,
        payment_status: booking.payment_status,
        price: booking.price
      },
      message: 'Booking created successfully (developer mode - no payment required)'
    })

  } catch (error) {
    logger.error("Error creating developer booking", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create developer booking" },
      { status: 500 }
    )
  }
} 