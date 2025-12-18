import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logger } from '@/shared/lib/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

// Type definitions
interface PaymentIntentRequest {
  amount: number
  currency?: string
  metadata?: Record<string, string>
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as PaymentIntentRequest
    const { amount, currency = 'usd', metadata } = body

    // Input validation
    if (amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'Amount is required' },
        { status: 400 }
      )
    }

    if (typeof amount !== 'number') {
      return NextResponse.json(
        { error: 'Amount must be a number' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Validate currency
    if (currency && typeof currency !== 'string') {
      return NextResponse.json(
        { error: 'Currency must be a string' },
        { status: 400 }
      )
    }

    // Validate currency code (basic validation for common currencies)
    const validCurrencies = ['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy', 'chf', 'cny']
    if (currency && !validCurrencies.includes(currency.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid currency code' },
        { status: 400 }
      )
    }

    // Validate metadata
    if (metadata !== undefined && (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))) {
      return NextResponse.json(
        { error: 'Metadata must be an object' },
        { status: 400 }
      )
    }

    // Validate metadata values are strings
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value !== 'string') {
          return NextResponse.json(
            { error: `Metadata value for key "${key}" must be a string` },
            { status: 400 }
          )
        }
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    })

    if (!paymentIntent.id || !paymentIntent.client_secret) {
      return NextResponse.json(
        { error: 'Failed to create payment intent' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
    })
  } catch (error) {
    logger.error('Error creating payment intent', error)
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}