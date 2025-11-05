import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Parse request body
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
    } = await req.json()

    // Validate required fields
    if (!barberId || !serviceId || !date) {
      return new Response(
        JSON.stringify({ error: 'barberId, serviceId, and date are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the barber's details and verify they are a developer
    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('id, is_developer, user_id')
      .eq('id', barberId)
      .single()

    if (barberError || !barber) {
      return new Response(
        JSON.stringify({ error: 'Barber not found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!barber.is_developer) {
      return new Response(
        JSON.stringify({ error: 'This barber is not a developer account' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, name, price, duration')
      .eq('id', serviceId)
      .single()

    if (serviceError || !service) {
      return new Response(
        JSON.stringify({ error: 'Service not found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Calculate add-on total
    let addonTotal = 0
    if (addonIds && addonIds.length > 0) {
      const { data: addons, error: addonsError } = await supabase
        .from('service_addons')
        .select('id, name, price')
        .in('id', addonIds)
        .eq('is_active', true)

      if (!addonsError && addons) {
        addonTotal = addons.reduce((total, addon) => total + (addon.price || 0), 0)
      }
    }

    // For developer accounts, no platform fees
    const platformFee = 0
    const barberPayout = service.price + addonTotal
    const totalPrice = service.price + addonTotal

    const bookingData = {
      barber_id: barberId,
      service_id: serviceId,
      date: date,
      end_time: new Date(new Date(date).getTime() + service.duration * 60000).toISOString(),
      notes: notes || '',
      guest_name: guestName || null,
      guest_email: guestEmail || null,
      guest_phone: guestPhone || null,
      client_id: clientId || null,
      status: 'confirmed',
      payment_status: 'succeeded',
      price: totalPrice,
      addon_total: addonTotal,
      platform_fee: platformFee,
      barber_payout: barberPayout,
      payment_intent_id: `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select('*, barber:barber_id(*), service:service_id(*), client:client_id(*)')
      .single()

    if (bookingError) {
      // Database trigger prevents conflicts - handle gracefully
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

    console.log('Developer booking created successfully:', booking)

    return new Response(
      JSON.stringify({ 
        success: true, 
        booking,
        message: 'Developer booking created successfully (no payment required)'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in create-developer-booking function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
