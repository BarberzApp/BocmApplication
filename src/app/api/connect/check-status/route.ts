import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { handleCorsPreflight, withCors } from '@/shared/lib/cors'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any,
})

interface CheckStatusRequest {
  barberId: string
}

export async function POST(request: NextRequest) {
  try {
    // Handle CORS preflight
    const preflightResponse = handleCorsPreflight(request);
    if (preflightResponse) return preflightResponse;

    const body = await request.json() as CheckStatusRequest
    const { barberId } = body

    // Input validation
    if (!barberId || typeof barberId !== 'string') {
      const response = NextResponse.json(
        { error: 'Barber ID is required and must be a string' },
        { status: 400 }
      )
      return withCors(request, response)
    }

    // Get barber's Stripe account ID
    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('stripe_account_id, stripe_account_status')
      .eq('id', barberId)
      .single()

    if (barberError) {
      logger.error('Error fetching barber', barberError)
      const response = NextResponse.json(
        { error: 'Failed to fetch barber details' },
        { status: 500 }
      )
      return withCors(request, response)
    }

    if (!barber) {
      const response = NextResponse.json(
        { error: 'Barber not found' },
        { status: 404 }
      )
      return withCors(request, response)
    }

    if (!barber.stripe_account_id) {
      const response = NextResponse.json({
        status: 'not_connected',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      })
      return withCors(request, response)
    }

    // Check Stripe account status
    try {
      const account = await stripe.accounts.retrieve(barber.stripe_account_id)
      
      // Update barber record with current Stripe status
      const { error: updateError } = await supabase
        .from('barbers')
        .update({
          stripe_account_status: account.charges_enabled ? 'active' : 'pending',
          stripe_account_ready: account.charges_enabled && account.details_submitted,
          updated_at: new Date().toISOString(),
        })
        .eq('id', barberId)

      if (updateError) {
        logger.error('Error updating barber status', updateError)
      }

      const response = NextResponse.json({
        status: account.charges_enabled ? 'active' : 'pending',
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements,
      })
      return withCors(request, response)
    } catch (stripeError) {
      logger.error('Error checking Stripe account', stripeError)
      const response = NextResponse.json(
        { error: 'Failed to check Stripe account status' },
        { status: 500 }
      )
      return withCors(request, response)
    }
  } catch (error) {
    logger.error('Error checking status', error)
    const response = NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 }
    )
    return withCors(request, response)
  }
}
