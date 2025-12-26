import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any,
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    logger.debug('Refreshing Stripe account status for user', { userId })

    // Get the barber record
    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('id, stripe_account_id, stripe_account_status')
      .eq('user_id', userId)
      .single()

    logger.debug('Barber query result', { barber, barberError })

    if (barberError || !barber) {
      logger.debug('No barber record found for user ID', { userId })
      logger.debug('Barber error', { error: barberError })
      
      // Let's also check if there are any barber records at all
      const { data: allBarbers, error: allBarbersError } = await supabase
        .from('barbers')
        .select('id, user_id, stripe_account_id')
        .limit(5)
      
      logger.debug('All barbers in database', { allBarbers })
      logger.debug('All barbers error', { error: allBarbersError })
      
      return NextResponse.json(
        { error: 'Barber record not found' },
        { status: 404 }
      )
    }

    if (!barber.stripe_account_id) {
      return NextResponse.json({
        success: false,
        message: 'No Stripe account found',
        data: {
          hasStripeAccount: false,
          status: null
        }
      })
    }

    // Check current status with Stripe
    try {
      const stripeAccount = await stripe.accounts.retrieve(barber.stripe_account_id)
      
      const newStatus = stripeAccount.charges_enabled ? 'active' : 'pending'
      const accountReady = stripeAccount.charges_enabled && stripeAccount.details_submitted
      
      // Update database if status has changed
      if (barber.stripe_account_status !== newStatus) {
        const { error: updateError } = await supabase
          .from('barbers')
          .update({
            stripe_account_status: newStatus,
            stripe_account_ready: accountReady,
            updated_at: new Date().toISOString(),
          })
          .eq('id', barber.id)

        if (updateError) {
          logger.error('Error updating account status', updateError)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Account status refreshed',
        data: {
          hasStripeAccount: true,
          stripeAccountId: barber.stripe_account_id,
          previousStatus: barber.stripe_account_status,
          currentStatus: newStatus,
          chargesEnabled: stripeAccount.charges_enabled,
          detailsSubmitted: stripeAccount.details_submitted,
          payoutsEnabled: stripeAccount.payouts_enabled,
          accountReady
        }
      })

    } catch (stripeError) {
      logger.error('Error retrieving Stripe account', stripeError)
      return NextResponse.json(
        { error: 'Failed to retrieve Stripe account status' },
        { status: 500 }
      )
    }

  } catch (error) {
    logger.error('Error refreshing account status', error)
    return NextResponse.json(
      { 
        error: 'Failed to refresh account status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 