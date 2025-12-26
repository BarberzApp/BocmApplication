import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const barberId = searchParams.get('barberId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!barberId) {
      return NextResponse.json({ error: 'Barber ID is required' }, { status: 400 })
    }

    logger.debug('Fetching payments for barber', { barberId })

    // Fetch bookings with payment information
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        barber_id,
        client_id,
        service_id,
        date,
        status,
        payment_status,
        payment_intent_id,
        price,
        platform_fee,
        barber_payout,
        notes,
        guest_name,
        guest_email,
        guest_phone,
        created_at,
        updated_at,
        services (
          id,
          name,
          description,
          duration,
          price
        ),
        profiles!bookings_client_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('barber_id', barberId)
      .eq('payment_status', 'succeeded')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (bookingsError) {
      logger.error('Error fetching bookings', bookingsError)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    // Fetch detailed payment records from payments table
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .in('booking_id', bookings?.map(b => b.id) || [])
      .order('created_at', { ascending: false })

    if (paymentsError) {
      logger.error('Error fetching payments', paymentsError)
      // Don't fail the request, just log the error
    }

    // Create a map of booking_id to payment details
    const paymentMap = new Map()
    payments?.forEach(payment => {
      paymentMap.set(payment.booking_id, payment)
    })

    // Combine booking and payment data
    const combinedData = bookings?.map(booking => ({
      ...booking,
      payment_details: paymentMap.get(booking.id) || null
    })) || []

    // Calculate totals
    const totals = combinedData.reduce((acc, booking) => {
      const price = booking.price || 0
      const platformFee = booking.platform_fee || 0
      const barberPayout = booking.barber_payout || 0

      return {
        totalRevenue: acc.totalRevenue + price,
        totalPlatformFees: acc.totalPlatformFees + platformFee,
        totalBarberPayout: acc.totalBarberPayout + barberPayout,
        totalBookings: acc.totalBookings + 1
      }
    }, {
      totalRevenue: 0,
      totalPlatformFees: 0,
      totalBarberPayout: 0,
      totalBookings: 0
    })

    return NextResponse.json({
      payments: combinedData,
      totals,
      pagination: {
        limit,
        offset,
        total: combinedData.length
      }
    })
  } catch (error) {
    logger.error('Error in barber payments API', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 