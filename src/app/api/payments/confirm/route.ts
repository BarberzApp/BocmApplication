import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logger } from '@/shared/lib/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

// Type definitions
interface ConfirmPaymentRequest {
  clientSecret: string
  paymentMethodId: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as ConfirmPaymentRequest
    const { clientSecret, paymentMethodId } = body

    // Input validation
    if (!clientSecret || typeof clientSecret !== 'string') {
      return NextResponse.json(
        { error: 'Client secret is required and must be a string' },
        { status: 400 }
      )
    }

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      return NextResponse.json(
        { error: 'Payment method ID is required and must be a string' },
        { status: 400 }
      )
    }

    // Validate client secret format (basic validation)
    if (!clientSecret.startsWith('pi_') || !clientSecret.includes('_secret_')) {
      return NextResponse.json(
        { error: 'Invalid client secret format' },
        { status: 400 }
      )
    }

    // Validate payment method ID format (basic validation)
    if (!paymentMethodId.startsWith('pm_')) {
      return NextResponse.json(
        { error: 'Invalid payment method ID format' },
        { status: 400 }
      )
    }

    const paymentIntent = await stripe.paymentIntents.confirm(clientSecret, {
      payment_method: paymentMethodId,
    })

    if (!paymentIntent.status) {
      return NextResponse.json(
        { error: 'Failed to confirm payment' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: paymentIntent.status,
    })
  } catch (error) {
    logger.error('Error confirming payment', error)
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}