import { NextResponse } from "next/server"
import Stripe from "stripe"
import { logger } from '@/shared/lib/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as any,
})

export async function POST() {
  try {
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
    })

    if (!setupIntent.client_secret) {
      return NextResponse.json(
        { error: "Failed to generate client secret" },
        { status: 500 }
      )
    }

    return NextResponse.json({ clientSecret: setupIntent.client_secret })
  } catch (error) {
    logger.error("Error creating setup intent", error)
    return NextResponse.json(
      { error: "Failed to create setup intent" },
      { status: 500 }
    )
  }
}