import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any as any,
})

// Type definitions
interface AccountLinkRequest {
  barberId: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as AccountLinkRequest
    const { barberId } = body

    // Input validation
    if (!barberId || typeof barberId !== 'string') {
      return NextResponse.json(
        { error: 'Barber ID is required and must be a string' },
        { status: 400 }
      )
    }

    if (barberId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Barber ID cannot be empty' },
        { status: 400 }
      )
    }

    // Get barber's Stripe account ID
    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('stripe_account_id')
      .eq('id', barberId)
      .single()

    if (barberError) {
      logger.error('Error fetching barber', barberError)
      return NextResponse.json(
        { error: 'Failed to fetch barber details' },
        { status: 500 }
      )
    }

    if (!barber) {
      return NextResponse.json(
        { error: 'Barber not found' },
        { status: 404 }
      )
    }

    if (!barber?.stripe_account_id) {
      return NextResponse.json(
        { error: 'No Stripe account found' },
        { status: 400 }
      )
    }

    // Validate environment variable
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bocmstyle.com';
    logger.debug('Using app URL for account link', { appUrl });

    // Create account link for dashboard access
    const accountLink = await stripe.accountLinks.create({
      account: barber.stripe_account_id,
      refresh_url: `${appUrl}/barber/connect/refresh`,
      return_url: `${appUrl}/barber/connect/return`,
      type: 'account_onboarding',
      collect: 'eventually_due' // For testing, collect all requirements upfront
    })

    if (!accountLink.url) {
      return NextResponse.json(
        { error: 'Failed to generate account link' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    logger.error('Error creating account link', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create account link' },
      { status: 500 }
    )
  }
}