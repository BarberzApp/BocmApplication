import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any,
})

// Type definitions
interface DashboardLinkRequest {
  barberId: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as DashboardLinkRequest
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
    logger.debug('Using app URL for dashboard link', { appUrl });

    // Create login link for dashboard access
    const loginLink = await stripe.accounts.createLoginLink(barber.stripe_account_id)

    if (!loginLink.url) {
      return NextResponse.json(
        { error: 'Failed to generate dashboard link' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: loginLink.url })
  } catch (error) {
    logger.error('Error creating dashboard link', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create dashboard link' },
      { status: 500 }
    )
  }
} 