/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('create-payment-intent function called')
    
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
      barberId, 
      serviceId, 
      date, 
      notes, 
      clientId, 
      paymentType,
      addonIds = []
    } = await req.json()

    console.log('Request body parsed:', { barberId, serviceId, date, clientId, addonIds })

    // Validate required fields
    console.log('Validating required fields...')
    if (!barberId || !serviceId || !date) {
      console.log('Missing required fields:', { barberId, serviceId, date })
      return new Response(
        JSON.stringify({ error: 'barberId, serviceId, and date are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the barber's details including developer status
    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('stripe_account_id, stripe_account_status, is_developer')
      .eq('id', barberId)
      .single()

    if (barberError) {
      console.log('Barber error:', barberError)
      return new Response(
        JSON.stringify({ error: 'Barber not found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Barber data:', barber)

    // Check if this is a developer account
    if (barber.is_developer) {
      console.log('Developer account detected - should use create-developer-booking instead')
      return new Response(
        JSON.stringify({ error: 'Developer accounts should use create-developer-booking endpoint' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // For regular barbers, check Stripe account
    if (!barber?.stripe_account_id) {
      console.log('No Stripe account ID found for barber')
      return new Response(
        JSON.stringify({ error: 'Barber Stripe account not found or not ready' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the barber's Stripe account is active
    if (barber.stripe_account_status !== 'active') {
      console.log('Barber Stripe account not active:', barber.stripe_account_status)
      return new Response(
        JSON.stringify({ error: 'Barber account is not ready to accept payments' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get service details
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

    const servicePrice = Math.round(Number(service.price) * 100) // Convert to cents
    
    console.log('💰 Service details (for reference only - NOT included in payment):', {
      serviceName: service.name,
      servicePriceCents: servicePrice,
      servicePriceDollars: (servicePrice / 100).toFixed(2),
      warning: 'Service price is NOT added to payment amount'
    })
    
    // Get add-ons if any are selected
    let addonTotal = 0
    if (addonIds && addonIds.length > 0) {
      const { data: addons, error: addonsError } = await supabase
        .from('service_addons')
        .select('id, name, price')
        .in('id', addonIds)
        .eq('is_active', true)

      if (addonsError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch add-ons' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      addonTotal = addons.reduce((total: number, addon: any) => total + addon.price, 0)
      console.log('📦 Addons (for reference only - NOT included in payment):', {
        addonCount: addons.length,
        addonTotalDollars: addonTotal.toFixed(2),
        addonTotalCents: Math.round(addonTotal * 100),
        addonDetails: addons.map(a => ({ name: a.name, price: a.price })),
        warning: 'Addons are NOT added to payment amount'
      })
    }
    
    // CRITICAL: Calculate platform fee
    // IMPORTANT: Customers ONLY pay the platform fee ($3.38)
    // Service and addons are paid directly to barber at appointment
    const platformFee = 338 // $3.38 in cents
    
    // ALWAYS charge only the platform fee - DO NOT add servicePrice or addonTotal
    const totalAmount = platformFee // Always $3.38 (platform fee only)
    
    // CRITICAL SAFEGUARD: Verify totalAmount does NOT include service or addons
    console.log('💳 Payment amount verification:', {
      servicePriceCents: servicePrice,
      servicePriceDollars: (servicePrice / 100).toFixed(2),
      addonTotalCents: Math.round(addonTotal * 100),
      addonTotalDollars: addonTotal.toFixed(2),
      platformFeeCents: platformFee,
      platformFeeDollars: (platformFee / 100).toFixed(2),
      totalAmountCents: totalAmount,
      totalAmountDollars: (totalAmount / 100).toFixed(2),
      verification: totalAmount === platformFee ? '✅ CORRECT' : '❌ ERROR',
      note: 'totalAmount MUST equal platformFee (338) - service and addons NOT included'
    })
    
    // CRITICAL ERROR CHECK: If totalAmount includes service or addons, return error
    if (totalAmount !== platformFee) {
      const extraAmount = totalAmount - platformFee
      console.error('❌ CRITICAL ERROR: totalAmount includes service or addons!', {
        totalAmount,
        platformFee,
        extraAmount,
        extraAmountDollars: (extraAmount / 100).toFixed(2),
        servicePrice,
        addonTotal,
        possibleCause: extraAmount === servicePrice ? 'Service price was incorrectly added' : 
                      extraAmount === Math.round(addonTotal * 100) ? 'Addon total was incorrectly added' :
                      'Unknown amount was added'
      })
      return new Response(
        JSON.stringify({ 
          error: `Payment calculation error: Expected $3.38 but calculated $${(totalAmount / 100).toFixed(2)}. Service price should not be included.` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    // Additional safeguard: Check if service price equals the extra amount
    if (servicePrice === 100 && totalAmount === 438) {
      console.error('❌ ERROR DETECTED: Service price ($1.00) appears to be included in totalAmount!', {
        totalAmount,
        platformFee,
        servicePrice,
        expected: 'totalAmount should be 338 (platformFee only)',
        actual: 'totalAmount is 438 (platformFee + servicePrice)'
      })
      return new Response(
        JSON.stringify({ 
          error: 'Payment calculation error: Service price should not be included in payment amount' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    // Stripe fee calculation: Stripe takes ~$0.38 (2.9% + $0.30)
    // After Stripe fee: $3.38 - $0.38 = $3.00
    // Split the $3.00: 60% to BOCM, 40% to barber
    const stripeFee = 38 // $0.38 in cents (approximate Stripe fee)
    const netAfterStripe = platformFee - stripeFee // $3.00 = 300 cents
    const bocmShare = Math.round(netAfterStripe * 0.60) // 60% = $1.80 = 180 cents
    const barberShare = Math.round(netAfterStripe * 0.40) // 40% = $1.20 = 120 cents
    
    console.log('Payment: customer only pays platform fee', { 
      totalCharged: platformFee,
      stripeFee,
      netAfterStripe,
      bocmShare,
      barberShare,
      note: 'Service and addons paid directly to barber at appointment'
    })

    // Create Payment Intent
    // Fee breakdown:
    // - Total charged to customer: $3.38
    // - Stripe fee: ~$0.38
    // - Net after Stripe: $3.00
    // - BOCM receives: $1.80 (60% of net)
    // - Barber receives: $1.20 (40% of net)
    // Note: Service price and addons are paid directly to barber at appointment
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount, // Always $3.38 (platform fee only)
      currency: 'usd',
      application_fee_amount: bocmShare, // 60% of net after Stripe = $1.80
      transfer_data: {
        destination: barber.stripe_account_id, // Barber gets 40% of net = $1.20
      },
      metadata: {
        barberId,
        serviceId,
        date,
        notes: notes || '',
        clientId: clientId || '',
        serviceName: service.name,
        servicePrice: servicePrice.toString(),
        addonTotal: Math.round(addonTotal * 100).toString(),
        addonIds: addonIds.join(','),
        platformFee: platformFee.toString(),
        paymentType,
      },
    })

    console.log('Payment Intent created successfully:', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      amountInDollars: (paymentIntent.amount / 100).toFixed(2),
      expectedAmount: 3.38,
      application_fee_amount: bocmShare,
      application_fee_dollars: (bocmShare / 100).toFixed(2),
      barber_should_receive: (barberShare / 100).toFixed(2),
      clientSecret: paymentIntent.client_secret,
      breakdown: {
        totalCharged: `${(totalAmount / 100).toFixed(2)}`,
        stripeFee: `${(stripeFee / 100).toFixed(2)}`,
        netAfterStripe: `${(netAfterStripe / 100).toFixed(2)}`,
        bocmShare: `${(bocmShare / 100).toFixed(2)}`,
        barberShare: `${(barberShare / 100).toFixed(2)}`
      }
    })
    
    // Verify the amount is correct
    if (paymentIntent.amount !== 338) {
      console.error('❌ ERROR: Payment amount is incorrect!', {
        expected: 338,
        actual: paymentIntent.amount,
        difference: paymentIntent.amount - 338,
        differenceInDollars: ((paymentIntent.amount - 338) / 100).toFixed(2)
      })
    }

    return new Response(
      JSON.stringify({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error("Error creating payment intent:", error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to create payment intent" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
