import { NextResponse } from "next/server"
import Stripe from "stripe"
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as any,
})

// Define required metadata fields
const REQUIRED_METADATA = {
  ALL: ['barberId', 'serviceId', 'date', 'basePrice'],
  GUEST: ['guestName', 'guestEmail', 'guestPhone']
}

// Type definitions
interface CheckoutMetadata {
  barberId: string
  serviceId: string
  date: string
  basePrice: string
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  notes?: string
  [key: string]: string | undefined
}

interface CheckoutSessionRequest {
  amount: string | number
  successUrl: string
  cancelUrl: string
  metadata: CheckoutMetadata
  clientId?: string | null
  customerPaysFee?: boolean
}

export async function POST(request: Request) {
  try {
    logger.debug('Starting checkout session creation...')
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

    // Get the barber's Stripe account ID and is_developer flag
    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('stripe_account_id, stripe_account_status, is_developer')
      .eq('id', barberId)
      .single()

    if (barberError || !barber?.stripe_account_id) {
      return NextResponse.json(
        { error: 'Barber Stripe account not found or not ready' },
        { status: 400 }
      )
    }

    // Verify the barber's Stripe account is active
    if (barber.stripe_account_status !== 'active') {
      return NextResponse.json(
        { error: 'Barber account is not ready to accept payments' },
        { status: 400 }
      )
    }

    // Get service details
    const { data: service, error: serviceError } = await supabase
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

    const servicePrice = Math.round(Number(service.price) * 100) // Convert to cents
    
    // Get add-ons if any are selected (deduplicate first)
    let addonTotal = 0
    let addonItems: any[] = []
    
    if (addonIds && addonIds.length > 0) {
      // Deduplicate addon IDs to prevent double-counting
      const uniqueAddonIds = [...new Set(addonIds)]
      const { data: addons, error: addonsError } = await supabase
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
      addonItems = addons.map(addon => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: addon.name,
            description: "Additional service"
          },
          unit_amount: Math.round(addon.price * 100),
        },
        quantity: 1,
      }))
    }
    
    // Platform fee calculation (matches mobile app)
    // Customer pays $3.38, Stripe takes $0.38, net is $3.00
    // Split $3.00: 60% to BOCM ($1.80), 40% to barber ($1.20)
    // BOCM absorbs the Stripe fee as a platform cost, so BOCM net = $1.80 - $0.38 = $1.42
    const platformFee = 338 // $3.38 in cents (what customer pays)
    const stripeFee = 38 // $0.38 in cents (Stripe's fee - absorbed by platform)
    const netAfterStripe = platformFee - stripeFee // $3.00 = 300 cents
    const bocmGrossShare = Math.round(netAfterStripe * 0.60) // 60% = $1.80 = 180 cents
    let bocmShare = bocmGrossShare - stripeFee // Platform net after absorbing Stripe fee = $1.42 = 142 cents
    let barberShare = Math.round(netAfterStripe * 0.40) // 40% = $1.20 = 120 cents

    // If barber is a developer, bypass all platform fees
    if (barber.is_developer) {
      bocmShare = 0
      barberShare = 0
    }

    // Customer only pays the platform fee (fee-only payment model)
    // Service price and addons are paid directly to barber at appointment
    const totalAmount = platformFee
    const transferAmount = barberShare // Barber gets 40% of fee (or 0 if developer)
    
    const lineItems = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Processing Fee",
            description: "Payment processing fee"
          },
          unit_amount: platformFee,
        },
        quantity: 1,
      }
    ]

    // Create success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bocmstyle.com'
    const successUrl = `${baseUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}/booking/cancel`

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_intent_data: {
        transfer_data: {
          destination: barber.stripe_account_id,
        },
        application_fee_amount: bocmShare, // Platform net after absorbing Stripe fee = $1.42 (or 0 for developer)
      },
      metadata: {
        barberId,
        serviceId,
        date,
        notes: notes || '',
        guestName: guestName || '',
        guestEmail: guestEmail || '',
        guestPhone: guestPhone || '',
        clientId: clientId || 'guest',
        serviceName: service.name,
        servicePrice: servicePrice.toString(),
        addonTotal: Math.round(addonTotal * 100).toString(),
        addonIds: [...new Set(addonIds)].join(','),
        platformFee: platformFee.toString(),
        paymentType: 'fee', // Always fee-only payment model
        feeType: 'fee_only',
        bocmShare: bocmShare.toString(),
        barberShare: barberShare.toString(),
        isDeveloper: barber.is_developer ? 'true' : 'false',
        // Add flag to indicate if add-ons need separate payment
        addonsPaidSeparately: (paymentType === 'fee' && addonIds.length > 0).toString(),
      },
    })

    logger.debug('Checkout session created successfully', {
      sessionId: session.id,
      url: session.url,
      amount: session.amount_total
    })

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id 
    })
  } catch (error) {
    logger.error("Error creating checkout session", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    )
  }
}