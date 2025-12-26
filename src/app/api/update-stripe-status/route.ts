import { NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, stripeAccountId, status } = body

    // Input validation
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'User ID is required and must be a string' },
        { status: 400 }
      )
    }

    if (!stripeAccountId || typeof stripeAccountId !== 'string') {
      return NextResponse.json(
        { error: 'Stripe account ID is required and must be a string' },
        { status: 400 }
      )
    }

    if (!status || typeof status !== 'string') {
      return NextResponse.json(
        { error: 'Status is required and must be a string' },
        { status: 400 }
      )
    }

    // Update barber record
    const { error: updateError } = await supabase
      .from('barbers')
      .update({
        stripe_account_id: stripeAccountId,
        stripe_account_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) {
      logger.error('Error updating barber', updateError)
      return NextResponse.json(
        { error: 'Failed to update barber record' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Stripe status updated successfully' 
    })
  } catch (error) {
    logger.error('Error updating Stripe status', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update Stripe status' },
      { status: 500 }
    )
  }
} 