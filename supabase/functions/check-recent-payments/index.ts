import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Create Stripe client
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20' as any,
    })

    // Parse request body
    const { 
      clientId,
      barberId,
      serviceId,
      date,
      notes,
      addonIds = []
    } = await req.json()

    // Validate required fields
    if (!clientId || !barberId || !serviceId || !date) {
      return new Response(
        JSON.stringify({ error: 'clientId, barberId, serviceId, and date are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get recent payments for this client (last 5 minutes)
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300 // 5 minutes ago
    
    const payments = await stripe.paymentIntents.list({
      created: { gte: fiveMinutesAgo },
      limit: 10,
    })

    console.log(`Found ${payments.data.length} recent payments`)

    // Check if any payment matches our criteria
    let matchingPayment = null
    console.log('Looking for payment with criteria:', { barberId, serviceId, clientId })
    
    for (const payment of payments.data) {
      console.log('Checking payment:', {
        id: payment.id,
        status: payment.status,
        metadata: payment.metadata,
        amount: payment.amount
      })
      
      // Check if payment is for the right barber and service
      if (payment.metadata?.barberId === barberId && 
          payment.metadata?.serviceId === serviceId &&
          payment.metadata?.clientId === clientId &&
          payment.status === 'succeeded') {
        matchingPayment = payment
        console.log('Found matching payment:', payment.id)
        break
      }
    }

    if (!matchingPayment) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No matching payment found' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Found matching payment:', matchingPayment.id)

    // Check if booking already exists for this payment
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('payment_intent_id', matchingPayment.id)
      .single()

    if (existingBooking) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Booking already exists for this payment',
          booking: existingBooking
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get service details for price calculation
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('name, price, duration')
      .eq('id', serviceId)
      .single()

    if (serviceError || !service?.price) {
      return new Response(
        JSON.stringify({ error: 'Service not found or missing price' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const servicePrice = Number(service.price)
    
    // Get add-ons if any are selected
    let addonTotal = 0
    if (addonIds && addonIds.length > 0) {
      const { data: addons, error: addonsError } = await supabase
        .from('service_addons')
        .select('id, name, price')
        .in('id', addonIds)
        .eq('is_active', true)

      if (!addonsError && addons) {
        addonTotal = addons.reduce((total, addon) => total + addon.price, 0)
      }
    }
    
    // Calculate fees
    const platformFee = 3.38 // $3.38
    const totalPrice = servicePrice + addonTotal + platformFee
    const barberPayout = servicePrice + addonTotal + (platformFee * 0.40) // 40% of fee + full service price

    // Get service duration for end_time calculation
    const bookingEndTime = new Date(new Date(date).getTime() + service.duration * 60000)

    const bookingData = {
      barber_id: barberId,
      service_id: serviceId,
      date: date,
      end_time: bookingEndTime.toISOString(),
      notes: notes || '',
      client_id: clientId,
      status: 'confirmed',
      payment_status: 'succeeded',
      price: totalPrice,
      addon_total: addonTotal,
      platform_fee: platformFee,
      barber_payout: barberPayout,
      payment_intent_id: matchingPayment.id,
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select('*, barber:barber_id(*), service:service_id(*), client:client_id(*)')
      .single()

    if (bookingError) {
      const isConflict = bookingError.message?.includes('conflicts') || 
                        bookingError.message?.includes('overlaps')
      
      return new Response(
        JSON.stringify({ 
          error: isConflict 
            ? 'This time slot is no longer available. Please select another time.'
            : 'Failed to create booking'
        }),
        { 
          status: isConflict ? 409 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Add add-ons if any are selected
    if (addonIds && addonIds.length > 0) {
      // Get add-on details to store correct prices
      const { data: addons, error: addonsError } = await supabase
        .from('service_addons')
        .select('id, name, price')
        .in('id', addonIds)
        .eq('is_active', true)

      if (!addonsError && addons) {
        const addonBookings = addonIds.map(addonId => {
          const addon = addons.find(a => a.id === addonId)
          return {
            booking_id: booking.id,
            addon_id: addonId,
            price: addon ? addon.price : 0, // Store actual add-on price
          }
        })

        const { error: addonError } = await supabase
          .from('booking_addons')
          .insert(addonBookings)

        if (addonError) {
          console.error('Error adding add-ons:', addonError)
          // Don't fail the booking if add-ons fail
        }
      }
    }

    console.log('Booking created successfully:', booking)

    return new Response(
      JSON.stringify({ 
        success: true, 
        booking,
        message: 'Booking created successfully from payment verification'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in check-recent-payments function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
